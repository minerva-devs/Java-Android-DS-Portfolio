package edu.cnm.deepdive.chat.service;

import edu.cnm.deepdive.chat.model.dto.Channel;
import edu.cnm.deepdive.chat.model.dto.Message;
import edu.cnm.deepdive.chat.model.dto.User;
import io.reactivex.rxjava3.core.Completable;
import io.reactivex.rxjava3.core.Single;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import retrofit2.http.Body;
import retrofit2.http.DELETE;
import retrofit2.http.GET;
import retrofit2.http.Header;
import retrofit2.http.POST;
import retrofit2.http.PUT;
import retrofit2.http.Path;
import retrofit2.http.Query;

public interface ChatServiceProxy {

  //GET request for our profile. From scratch-minerva.http file on server> work
  @GET("user/me")
  Single<User> getProfile(@Header("Authorization") String bearerToken);

  @PUT("users/me")
  Single<User> putProfile(@Body User user, @Header("Authorization") String bearerToken);

  @GET("users/{key}")
  Single<User> getProfile(@Path("key") UUID key, @Header("Authorization") String bearerToken);

  @GET("channels")
  Single<List<Channel>> getChannels(@Header("Authorization") String bearerToken);

  @GET("channels")
  Single<List<Channel>> getChannels(@Query("active") boolean active,
      @Header("Authorization") String bearerToken);

  @GET("channels/{key}")
  Single<Channel> getChannel(@Path("key") UUID key, @Header("Authorization") String bearerToken);

  @DELETE("channels/{key}")
  Completable deleteChannel(@Path("key") UUID key, @Header("Authorization") String bearerToken);

  // TODO: 3/12/25 Add PUT & GET endpoints for channel name & active.

  //we're posting a msg to a channel-which is specified with a key
  @POST("channels/{key}/messages")
  Single<List<Message>> postMessage(@Body Message message, @Path("key") UUID key,
      @Query("since") Instant since, @Header("Authorization") String bearerToken);

}
