package edu.cnm.deepdive.farkle.service;

import edu.cnm.deepdive.farkle.model.dto.Game;
import edu.cnm.deepdive.farkle.model.dto.RollAction;
import edu.cnm.deepdive.farkle.model.dto.User;
import io.reactivex.rxjava3.core.Single;
import java.util.UUID;
import retrofit2.http.Body;
import retrofit2.http.GET;
import retrofit2.http.Header;
import retrofit2.http.POST;
import retrofit2.http.Path;

public interface FarkleApiProxy {

  /**
   * Retrieves a game from the backend service, with optional additional parameters for state.
   *
   * @param gameId Unique identifier for the game.
   * @return Asynchronous call containing game data.
   */
  @GET("games/{gameId}")
  Single<Game> getGame(@Path("gameId") UUID gameId,
      @Header("Authorization") String bearerToken
  );

  @GET("users/me")
  Single<User> getMe(@Header("Authorization") String bearerToken);


  @POST("games/{gameKey}/actions")
  Single<Boolean> freezeOrContinue(
      @Path("gameKey") UUID gameKey,
      @Body RollAction action,
      @Header("Authorization") String bearerToken
  );

  @POST("games")
  Single<Game> startOrJoin(@Header("Authorization") String bearerToken);

}
