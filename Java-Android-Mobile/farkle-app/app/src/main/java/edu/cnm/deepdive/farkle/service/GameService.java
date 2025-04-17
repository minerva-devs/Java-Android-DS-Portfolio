package edu.cnm.deepdive.farkle.service;

import edu.cnm.deepdive.farkle.model.dto.Game;
import edu.cnm.deepdive.farkle.model.dto.RollAction;
import edu.cnm.deepdive.farkle.model.dto.State;
import edu.cnm.deepdive.farkle.model.dto.User;
import io.reactivex.rxjava3.core.Scheduler;
import io.reactivex.rxjava3.core.Single;
import io.reactivex.rxjava3.schedulers.Schedulers;
import java.util.UUID;
import javax.inject.Inject;
import javax.inject.Singleton;

@Singleton
public class GameService {

  private static final String BEARER_TOKEN_FORMAT = "Bearer %s";

  private final GoogleSignInService signInService;
  private final FarkleApiProxy farkleApi;
  private final FarkleApiLongPollingProxy farkleApiLong;
  private final Scheduler scheduler;

  @Inject
  GameService(GoogleSignInService signInService, FarkleApiProxy farkleApi,
      FarkleApiLongPollingProxy farkleApiLong) {
    this.signInService = signInService;
    this.farkleApi = farkleApi;
    this.farkleApiLong = farkleApiLong;
    scheduler = Schedulers.io();
  }

  public Single<Game> startOrJoin() {
    return signInService
        .refreshBearerToken()
        .observeOn(scheduler)
        .map((token) -> String.format(BEARER_TOKEN_FORMAT, token))
        .flatMap(farkleApi::startOrJoin);
  }

  public Single<Game> getGame(UUID gameId) {
    return signInService
        .refreshBearerToken()
        .observeOn(scheduler)
        .map((token) -> String.format(BEARER_TOKEN_FORMAT, token))
        .flatMap((token) -> farkleApi.getGame(gameId, token));
  }

  public Single<User> getUser() {
    return signInService
        .refreshBearerToken()
        .observeOn(scheduler)
        .map((token) -> String.format(BEARER_TOKEN_FORMAT, token))
        .flatMap(farkleApi::getMe);
  }


  public Single<Game> getGame(UUID gameId, State state, int rollCount) {
    return signInService
        .refreshBearerToken()
        .observeOn(scheduler)
        .map((token) -> String.format(BEARER_TOKEN_FORMAT, token))
        .flatMap((token) -> farkleApiLong.getGame(gameId, state, rollCount, token));
  }

  public Single<Boolean> freezeOrContinue(UUID gameKey, RollAction rollAction) {
    return signInService
        .refreshBearerToken()
        .observeOn(scheduler)
        .map((token) -> String.format(BEARER_TOKEN_FORMAT, token))
        .flatMap((token) -> farkleApi.freezeOrContinue(gameKey, rollAction, token));
  }

}

