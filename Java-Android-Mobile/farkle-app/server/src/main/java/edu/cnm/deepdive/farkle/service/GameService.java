package edu.cnm.deepdive.farkle.service;

import edu.cnm.deepdive.farkle.model.dao.GameRepository;
import edu.cnm.deepdive.farkle.model.dto.RollAction;
import edu.cnm.deepdive.farkle.model.entity.Game;
import edu.cnm.deepdive.farkle.model.entity.GamePlayer;
import edu.cnm.deepdive.farkle.model.entity.Roll;
import edu.cnm.deepdive.farkle.model.entity.Roll.Die;
import edu.cnm.deepdive.farkle.model.entity.State;
import edu.cnm.deepdive.farkle.model.entity.Turn;
import edu.cnm.deepdive.farkle.model.entity.User;
import java.util.Arrays;
import java.util.EnumSet;
import java.util.Iterator;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.UUID;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import java.util.random.RandomGenerator;
import java.util.stream.IntStream;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.web.context.request.async.DeferredResult;

@Service
public class GameService implements AbstractGameService {

  private static final long POLLING_TIMEOUT_MS = 20_000L;
  private static final int POLLING_POOL_SIZE = 4;
  private static final long POLLING_INTERVAL_MS = 2000L;
  private static final PageRequest TOP_ONE = PageRequest.of(0, 1);
  private static final int WINNING_THRESHOLD = 2000; // FIXME: 4/5/25 Revert to 10000, when ready
  private static final Map<List<Integer>, Integer> FARKLE_SCORES = Map.ofEntries(
      Map.entry(List.of(1), 100),
      Map.entry(List.of(5), 50),
      Map.entry(List.of(1, 1, 1), 1000),
      Map.entry(List.of(2, 2, 2), 200),
      Map.entry(List.of(3, 3, 3), 300),
      Map.entry(List.of(4, 4, 4), 400),
      Map.entry(List.of(5, 5, 5), 500),
      Map.entry(List.of(6, 6, 6), 600),
      Map.entry(List.of(1, 1, 1, 1), 1000),
      Map.entry(List.of(2, 2, 2, 2), 1000),
      Map.entry(List.of(3, 3, 3, 3), 1000),
      Map.entry(List.of(4, 4, 4, 4), 1000),
      Map.entry(List.of(5, 5, 5, 5), 1000),
      Map.entry(List.of(6, 6, 6, 6), 1000),
      Map.entry(List.of(1, 1, 1, 1, 1), 2000),
      Map.entry(List.of(2, 2, 2, 2, 2), 2000),
      Map.entry(List.of(3, 3, 3, 3, 3), 2000),
      Map.entry(List.of(4, 4, 4, 4, 4), 2000),
      Map.entry(List.of(5, 5, 5, 5, 5), 2000),
      Map.entry(List.of(6, 6, 6, 6, 6), 2000),
      Map.entry(List.of(1, 1, 1, 1, 1, 1), 3000),
      Map.entry(List.of(2, 2, 2, 2, 2, 2), 3000),
      Map.entry(List.of(3, 3, 3, 3, 3, 3), 3000),
      Map.entry(List.of(4, 4, 4, 4, 4, 4), 3000),
      Map.entry(List.of(5, 5, 5, 5, 5, 5), 3000),
      Map.entry(List.of(6, 6, 6, 6, 6, 6), 3000),
      Map.entry(List.of(1, 2, 3, 4, 5, 6), 1500),
      Map.entry(List.of(1, 1, 2, 2, 3, 3), 1500),
      Map.entry(List.of(1, 1, 2, 2, 4, 4), 1500),
      Map.entry(List.of(1, 1, 2, 2, 5, 5), 1500),
      Map.entry(List.of(1, 1, 2, 2, 6, 6), 1500),
      Map.entry(List.of(1, 1, 3, 3, 4, 4), 1500),
      Map.entry(List.of(1, 1, 3, 3, 5, 5), 1500),
      Map.entry(List.of(1, 1, 3, 3, 6, 6), 1500),
      Map.entry(List.of(1, 1, 4, 4, 5, 5), 1500),
      Map.entry(List.of(1, 1, 4, 4, 6, 6), 1500),
      Map.entry(List.of(1, 1, 5, 5, 6, 6), 1500),
      Map.entry(List.of(2, 2, 3, 3, 4, 4), 1500),
      Map.entry(List.of(2, 2, 3, 3, 5, 5), 1500),
      Map.entry(List.of(2, 2, 3, 3, 6, 6), 1500),
      Map.entry(List.of(2, 2, 4, 4, 5, 5), 1500),
      Map.entry(List.of(2, 2, 4, 4, 6, 6), 1500),
      Map.entry(List.of(2, 2, 5, 5, 6, 6), 1500),
      Map.entry(List.of(3, 3, 4, 4, 5, 5), 1500),
      Map.entry(List.of(3, 3, 4, 4, 6, 6), 1500),
      Map.entry(List.of(3, 3, 5, 5, 6, 6), 1500),
      Map.entry(List.of(4, 4, 5, 5, 6, 6), 1500)
      // TODO: 4/2/25 Confirm that this table is complete.
  );

  private final GameRepository gameRepository;
  private final RandomGenerator rng;
  private final ScheduledExecutorService scheduler;

  public GameService(GameRepository gameRepository, RandomGenerator rng) {
    this.gameRepository = gameRepository;
    this.rng = rng;
    scheduler = Executors.newScheduledThreadPool(POLLING_POOL_SIZE);
  }

  @Override
  public Game startOrJoin(User user) {
    return gameRepository
        .findByPlayersContainsAndStateIn(user, EnumSet.of(State.PRE_GAME, State.IN_PLAY))
        .orElseGet(() -> gameRepository
            .findByState(State.PRE_GAME)
            .map((game) -> {
              game.setState(State.IN_PLAY);
              List<GamePlayer> players = game.getPlayers();
              GamePlayer player = new GamePlayer();
              player.setUser(user);
              player.setGame(game);
              players.add(player);
              Roll nextRoll;
              User currentUser = null;
              do {
                currentUser = startNewTurn(game, currentUser);
                nextRoll = game.getCurrentTurn().getLastRoll();
              } while (nextRoll.isFarkle());
              return gameRepository.save(game);
            })
            .orElseGet(() -> {
              Game game = new Game();
              game.setState(State.PRE_GAME);
              List<GamePlayer> players = game.getPlayers();
              GamePlayer player = new GamePlayer();
              player.setUser(user);
              player.setGame(game);
              players.add(player);
              return gameRepository.save(game);
            })
        );
  }

  @Override
  public boolean freezeOrContinue(RollAction action, UUID key, User user) {
    return gameRepository
        .findByExternalKeyAndPlayersUserContains(key, user)
        .map((game) -> {
          boolean continueTurn = true;
          if (game.getState() != State.IN_PLAY) {
            throw new IllegalStateException();
          }
          Turn currentTurn = game.getCurrentTurn();
          Roll currentRoll = currentTurn.getRolls().getLast();
          if (!currentTurn.getUser().equals(user)) {
            throw new IllegalStateException();
          }
          List<Die> dice = new LinkedList<>(currentRoll.getDice());
          int groupNumber = 0;
          for (int[] group : action.getFrozenGroups()) {
            groupNumber++;
            int score = FARKLE_SCORES
                .getOrDefault(Arrays.stream(group).sorted().boxed().toList(), 0);
            if (score == 0) {
              throw new IllegalArgumentException();
            } else {
              currentRoll.setRollScore(currentRoll.getRollScore() + score);
            }
            VALUE_LOOP:
            for (int value : group) {
              for (Iterator<Die> iterator = dice.iterator(); iterator.hasNext(); ) {
                Die die = iterator.next();
                if (die.getValue() == value) {
                  die.setGroup(groupNumber);
                  iterator.remove();
                  continue VALUE_LOOP;
                }
              }
              throw new IllegalArgumentException();
            }
          }
          if (currentRoll.getRollScore() == 0) {
            currentRoll.setFarkle(true);
          }
          Roll nextRoll = null;
          if (currentRoll.isFarkle()
              || dice.isEmpty()
              || action.isFinished()) { // FIXME: 3/24/2025 add conditions to verify allowed to end turn
            currentTurn.setFinished(true);
            continueTurn = false;
            // TOD Check for score over winning threshold
            if (!currentRoll.isFarkle()
                && game
                .getTurns()
                .stream()
                .filter((turn) -> turn.getUser().equals(user))
                .mapToInt(Turn::getScore)
                .sum() >= WINNING_THRESHOLD) {
              game.setState(State.FINISHED);
              game.setWinner(user);
            }
            if (game.getState() == State.IN_PLAY) {
              startNewTurn(game, user);
              nextRoll = game.getCurrentTurn().getLastRoll();
            }
          } else {
            nextRoll = addRoll(currentTurn, dice.size());
          }
          if (game.getState() == State.IN_PLAY) {
            //noinspection DataFlowIssue
            while (nextRoll.isFarkle()) {
              User currentUser = currentTurn.getUser();
              startNewTurn(game, currentUser);
              nextRoll = game.getCurrentTurn().getLastRoll();
              continueTurn = false;
            }
          }
          // TODO: 4/4/25 Check for game end conditions
          gameRepository
              .save(game);
          return continueTurn;
        })

        .orElseThrow();

    // TODO: 3/21/25 Check if this turn puts the game in 'last round' state
    // TODO: 3/21/25 If turn over, advance to the next turn and user
  }

  @Override
  public Game getGame(UUID gameKey, User user) {
    return gameRepository
        .findByExternalKeyAndPlayersUserContains(gameKey, user)
        .orElseThrow();
  }

  @Override
  public DeferredResult<Game> getGame(UUID gameKey, User user, State state, int rollCount)
      throws Throwable {
    DeferredResult<Game> result = new DeferredResult<>(POLLING_TIMEOUT_MS);
    ScheduledFuture<?>[] futurePolling = new ScheduledFuture<?>[1];
    result.onTimeout(() -> sendGameStatus(gameKey, user, result, futurePolling));
    Runnable pollingTask = () ->
        checkForStateChange(gameKey, user, state, rollCount, result, futurePolling);
    futurePolling[0] = scheduler.scheduleWithFixedDelay(pollingTask, 0,
        POLLING_INTERVAL_MS, TimeUnit.MILLISECONDS);
/*
    try {
      futurePolling[0].get();
    } catch (ExecutionException e) {
      throw e.getCause();
    } catch (InterruptedException e) {
      throw new RuntimeException(e);
    }
*/
    return result;
  }

  private void checkForStateChange(UUID gameKey, User user, State state, int rollCount,
      DeferredResult<Game> result, ScheduledFuture<?>[] futurePolling) {
    List<Boolean> stateChanged = gameRepository
        .checkForUpdates(gameKey, user.getId(), state.name(), rollCount, TOP_ONE);
    if (stateChanged.isEmpty() || stateChanged.getFirst() == null) {
      throw new NoSuchElementException();
    } else if (stateChanged.getFirst()) {
      sendGameStatus(gameKey, user, result, futurePolling);
    }
  }

  private void sendGameStatus(UUID gameKey, User user, DeferredResult<Game> result,
      ScheduledFuture<?>[] futurePolling) {
    Game game = gameRepository
        .findByExternalKeyAndPlayersUserContains(gameKey, user)
        .orElseThrow();
    result.setResult(game);
    futurePolling[0].cancel(true);
  }


  private User startNewTurn(Game game, User currentUser) {
    Turn turn = new Turn();
    User nextUser;
    List<GamePlayer> players = game.getPlayers();
    if (currentUser == null) {
      nextUser = players.getFirst().getUser();
    } else {
      int position = players
          .stream()
          .map(GamePlayer::getUser)
          .toList()
          .indexOf(currentUser);
      nextUser = players.get((position + 1) % players.size()).getUser();
    }
    turn.setUser(nextUser);
    turn.setGame(game);
    game.getTurns().add(turn);
    addRoll(turn, 6);
    return nextUser;
  }

  private Roll addRoll(Turn turn, int numberOfDice) {
    Roll roll = new Roll();
    roll.setTurn(turn);
    roll.setNumberDice(numberOfDice);
    turn.getRolls().add(roll);
    List<Die> dice = IntStream.generate(() -> rng.nextInt(1, 7))
        .limit(numberOfDice)
        .sorted()
        .mapToObj((value) -> {
          Die die = new Die();
          die.setValue(value);
          return die;
        })
        .toList();
    roll.getDice().addAll(dice);

    // Check if the dice just rolled is a farkle
    if (!hasScoringCombination(new LinkedList<>(), dice)) {
      roll.setFarkle(true);
      turn.setFinished(true);
    }
    return roll;
  }

  public boolean hasScoringCombination(List<Die> selection, List<Die> candidates) {
    boolean result;
    List<Integer> diceValues = selection.stream()
        .map(Die::getValue)
        .toList();
    if (FARKLE_SCORES.containsKey(diceValues)) {
      result = true;
    } else if (candidates.isEmpty()) {
      result = false;
    } else {
      List<Die> inclusiveSelection = new LinkedList<>(selection);
      inclusiveSelection.add(candidates.getFirst());
      result = hasScoringCombination(selection, candidates.subList(1, candidates.size()))
          || hasScoringCombination(inclusiveSelection, candidates.subList(1, candidates.size()));
    }
    return result;
  }
}


