package edu.cnm.deepdive.farkle.service;

import edu.cnm.deepdive.farkle.model.dto.Game;
import edu.cnm.deepdive.farkle.model.dto.State;
import io.reactivex.rxjava3.core.Single;
import java.util.UUID;
import retrofit2.http.GET;
import retrofit2.http.Header;
import retrofit2.http.Path;
import retrofit2.http.Query;

public interface FarkleApiLongPollingProxy {

  /**
   * Retrieves a game from the backend service, with optional additional parameters for state.
   *
   * @param gameId Unique identifier for the game.
   * @return Asynchronous call containing game data.
   */
  @GET("games/{gameId}")
  Single<Game> getGame(@Path("gameId") UUID gameId,
      @Query("state") State state,
      @Query("rollCount") int rollCount,
      @Header("Authorization") String bearerToken);

}
