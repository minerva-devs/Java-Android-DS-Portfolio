package edu.cnm.deepdive.chat.service;

import edu.cnm.deepdive.chat.model.dto.Message;
import io.reactivex.rxjava3.core.Single;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import retrofit2.http.GET;
import retrofit2.http.Header;
import retrofit2.http.Path;
import retrofit2.http.Query;

public interface ChatServiceLongPollingProxy {

  @GET("channels/{key}/messages")
  Single<List<Message>> getSince(@Path("key") UUID key, @Query("since") Instant since,
      @Header("Authorization") String bearerToken);


}
