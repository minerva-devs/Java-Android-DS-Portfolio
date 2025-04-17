package edu.cnm.deepdive.spaceseek.service;

import edu.cnm.deepdive.spaceseek.model.entity.Apod;
import io.reactivex.rxjava3.core.Single;
import java.time.LocalDate;
import java.util.List;
import retrofit2.http.GET;
import retrofit2.http.Query;

public interface ApodProxyService {

  @GET("apod")
  Single<List<Apod>> getDateRange(
      @Query("start_date") LocalDate startDate,
      @Query("end_date") LocalDate endDate,
      @Query("api_key") String apiKey);

  @GET("apod")
  Single<Apod> getToday(
      @Query("api_key") String apiKey);

  @GET("apod")
  Single<List<Apod>> getOpenDateRange(
      @Query("start_date") LocalDate startDate,
      @Query("api_key") String apiKey);

}
