package edu.cnm.deepdive.fizzbuzz.viewmodel;

import android.content.SharedPreferences;
import android.content.res.Resources;
import android.util.Log;
import android.app.Application;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.lifecycle.AndroidViewModel;
import androidx.lifecycle.LiveData;
import androidx.lifecycle.MutableLiveData;
import androidx.lifecycle.Transformations;
import androidx.lifecycle.ViewModel;
import androidx.preference.PreferenceManager;
import edu.cnm.deepdive.fizzbuzz.R;
import edu.cnm.deepdive.fizzbuzz.model.FizzBuzz;
import edu.cnm.deepdive.fizzbuzz.model.Game;
import edu.cnm.deepdive.fizzbuzz.model.Round;
import edu.cnm.deepdive.fizzbuzz.service.GameService;
import java.util.List;
import java.util.Random;
import java.util.Set;
import java.util.function.Function;
import java.util.function.Supplier;

public class GameViewModel extends AndroidViewModel {

  private static final String TAG = GameViewModel.class.getSimpleName();
  private static final int MILLIS_PER_SECOND = 1000;

  private final MutableLiveData<Game> game;
  private final LiveData<Boolean> running;
  private final LiveData<List<Round>> rounds;
  private final LiveData<Integer> count;
  private final MutableLiveData<Integer> elapsed;
  private final LiveData<Double> elapsedFraction;
  private final MutableLiveData<Set<FizzBuzz>> guess;
  private final MutableLiveData<Throwable> throwable;
  private final GameService service;
  private final String numRoundsKey;
  private final int numRoundsDefault;
  private final String timeLimitKey;
  private final int timeLimitDefault;
  private final String digitLengthKey;
  private final int digitLengthDefault;
  private final SharedPreferences prefs;

  public GameViewModel(@NonNull Application application) {
    super(application);
    game = new MutableLiveData<>(null);
    running = Transformations.distinctUntilChanged(Transformations.map(game,
        (game) -> mapIfNotNullElse(game, (g) -> g.getCount() < g.getLength(), false)));
    rounds = Transformations.map(game,
        (game) -> mapIfNotNullElseGet(game, Game::getRounds, List::of));
    //**when rounds variable gets invoked, the rounds will be updated, unless the rounds of the game is completed.
    //the Get method must return a list of rounds
    //If game is not null, then invoke the rounds method. If it is null, then go to the supplier -List- with whatever it has.
    //Otherwise, don't touch supplier- mapIfNotNullElse supplies a piece of machinery that will output value.
    count = Transformations.distinctUntilChanged(Transformations.map(rounds, List::size));
    elapsed = new MutableLiveData<>(0);
    elapsedFraction = Transformations.map(elapsed, (elapsed) ->
        mapIfNotNullElse(game.getValue(), (g) -> elapsed / (double) g.getTimeLimit(), 0.0));     //Defining an implementation of a method, parameters can be named same as fields
    guess = new MutableLiveData<>(null);
    throwable = new MutableLiveData<>();
    service = new GameService(new Random());// FIXME: 2025-02-04 Use dependency injection framework for GameService and Random.
    Resources resources = application.getResources();
    numRoundsKey = resources.getString(R.string.num_rounds_key);
    numRoundsDefault = resources.getInteger(R.integer.num_rounds_default);
    timeLimitKey = resources.getString(R.string.time_limit_key);
    timeLimitDefault = resources.getInteger(R.integer.time_limit_default);
    digitLengthKey = resources.getString(R.string.digit_length_key);
    digitLengthDefault = resources.getInteger(R.integer.digit_length_default);
    prefs = PreferenceManager.getDefaultSharedPreferences(application);
  }

  public LiveData<Game> getGame() {
    return game;
  }

  public LiveData<Boolean> getRunning() {
    return running;
  }

  public LiveData<List<Round>> getRounds() {
    return rounds;
  }

  public LiveData<Integer> getCount() {
    return count;
  }

  public LiveData<Integer> getElapsed() {
    return elapsed;
  }

  public LiveData<Double> getElapsedFraction() {
    return elapsedFraction;
  }

  public LiveData<Set<FizzBuzz>> getGuess() {
    return guess;
  }

  public void setGuess(@Nullable Set<FizzBuzz> guess) {this.guess.setValue(guess); }

  public LiveData<Throwable> getThrowable() {
    return throwable;
  }

  public void startGame() {
    throwable.setValue(null);
    int numRounds = prefs.getInt(numRoundsKey, numRoundsDefault);
    int timeLimit = prefs.getInt(timeLimitKey, timeLimitDefault) * MILLIS_PER_SECOND;
    int upperBound = (int) Math.pow(10, prefs.getInt(digitLengthKey, digitLengthDefault)) - 1;
    service
        .startGame(numRounds, timeLimit, upperBound)
        .subscribe(
            (game) -> {
              this.game.postValue(game);
              startRound(game);
            },
            this::postThrowable
        );
  }

  private void startRound(Game game) {
    throwable.postValue(null);
// DONE: 2025-02-03 Using Game instance referenced by game LiveData, invoke service method to
//  start round; when confirmation of round start is received, update game LiveData.
    service
        .startRound(game)
// Invoking method here on the observable integer, we pass in callbacks from things we can observe in an observable, completion event and error.
        .subscribe(
// Observable
            (elapsed) -> {
              this.elapsed.postValue(elapsed);
            },
// error
            this::postThrowable,
            () -> finishRound(game)
// DONE: 2/4/25 Read user's guess from data passed in by UI controller and pass
//  with game in invocation of service.finishRound(game, guess)
//this.game.postValue(game);   //lets observers of game do something - live data. this is the consumer of the postValue
//invoking finishRound
               );
  }

  //a boolean is coming downstream that tells us if user was correct or not
  private void finishRound(Game game) {
    throwable.postValue(null);
    service.
        // This returns a machine only, that gets something/a value
        finishRound(game, guess.getValue())
        //subscribe is the consumer of an event
        .subscribe(
            (correct) -> {
              this.game.postValue(game);
              //here we ask, is it still running?(game.getCount() < game.getLength()) -says the same, if the game is still running, start next round
              if (game.isRunning()) {
                //then start a new round
                startRound(game);
              }

            },        //These are 2 consumer lambdas. We can name them anything we want, even names of other elements. So the g invokes postValue game
            this::postThrowable    // t invokes postThrowable t. t is a consumer of postThrowable t   (t) -> postThrowable(t)
        );
  }
//it's only after starting a game that we need a new object

  private <T> T mapIfNotNullElse(Game game, Function<Game, T> mapper, T defaultValue) {
    return (game != null) ? mapper.apply(game) : defaultValue;
  }

  private<T> T mapIfNotNullElseGet(Game game, Function<Game, T> mapper, Supplier<T> supplier) {
    return (game !=null) ? mapper.apply(game) : supplier.get();
  }

  private void postThrowable(Throwable throwable) {
    Log.e(TAG, throwable.getMessage(), throwable);
    this.throwable.postValue(throwable);
  }

}
