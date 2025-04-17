package edu.cnm.deepdive.fizzbuzz.service;

import edu.cnm.deepdive.fizzbuzz.model.FizzBuzz;
import edu.cnm.deepdive.fizzbuzz.model.Game;
import io.reactivex.rxjava3.core.Observable;
import io.reactivex.rxjava3.core.Scheduler;
import io.reactivex.rxjava3.core.Single;
import io.reactivex.rxjava3.schedulers.Schedulers;
import java.util.Random;
import java.util.Set;
import java.util.concurrent.TimeUnit;

public class GameService {
  // Expressed in milliseconds.
  private static final int TICK_INTERVAL = 20;

  private final Random rng;
  private final Scheduler scheduler = Schedulers.single();

  public GameService(Random rng) {
    this.rng = rng;
  }

  public Single<Game> startGame(int length, int millisPerRound, int upperBound) {
    return Single.fromCallable(() -> new Game(length, upperBound, millisPerRound, rng))
        .subscribeOn(scheduler);
  }

  public Observable<Integer> startRound(Game game) {
    int ticks = game.getTimeLimit() / TICK_INTERVAL + 1;
    long startTime = System.currentTimeMillis();
    return Single.fromCallable(game::startRound)
        .flatMapObservable((c) ->
            Observable.intervalRange(0, ticks, 0, TICK_INTERVAL, TimeUnit.MILLISECONDS)
        )
        .map((count) -> (int) (System.currentTimeMillis() - startTime))
        .subscribeOn(scheduler);
  }

  //game.finishRound(guess);  finishRound returns a boolean
  public Single<Boolean> finishRound(Game game, Set<FizzBuzz> guess) {
    return Single.fromCallable(() -> game.finishRound(guess))
        .subscribeOn(scheduler);
  }

}
