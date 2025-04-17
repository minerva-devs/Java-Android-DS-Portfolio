package edu.cnm.deepdive.spaceseek.hilt;

import android.content.Context;
import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonDeserializer;
import dagger.Module;
import dagger.Provides;
import dagger.hilt.InstallIn;
import dagger.hilt.android.qualifiers.ApplicationContext;
import dagger.hilt.components.SingletonComponent;
import edu.cnm.deepdive.spaceseek.R;
import edu.cnm.deepdive.spaceseek.service.ApodProxyService;
import java.time.LocalDate;
import javax.inject.Singleton;
import okhttp3.Interceptor;
import okhttp3.OkHttpClient;
import okhttp3.logging.HttpLoggingInterceptor;
import okhttp3.logging.HttpLoggingInterceptor.Level;
import retrofit2.Retrofit;
import retrofit2.adapter.rxjava3.RxJava3CallAdapterFactory;
import retrofit2.converter.gson.GsonConverterFactory;

@Module
@InstallIn(SingletonComponent.class)
public class ProxyModule {

  @Provides
  @Singleton
  Gson provideGson() {
    return new GsonBuilder()
        .excludeFieldsWithoutExposeAnnotation()
        .registerTypeAdapter(LocalDate.class, (JsonDeserializer<LocalDate>)
            (element, type, context) -> LocalDate.parse(element.getAsString()))
        .create();
  }

  @Provides
  @Singleton
  Interceptor provideInterceptor(@ApplicationContext Context context) {
    return new HttpLoggingInterceptor()
        .setLevel(Level.valueOf(context.getString(R.string.log_level).toUpperCase()));
  }

  @Provides
  @Singleton
  OkHttpClient provideClient(Interceptor interceptor) {
    return new OkHttpClient.Builder()
        .addInterceptor(interceptor)
        .build();
  }

  @Provides
  @Singleton
  ApodProxyService provideProxy(
      @ApplicationContext Context context, Gson gson, OkHttpClient client) {
    return new Retrofit.Builder()
        .client(client)
        .addConverterFactory(GsonConverterFactory.create(gson))
        .addCallAdapterFactory(RxJava3CallAdapterFactory.create())
        .baseUrl(context.getString(R.string.base_url))
        .build()
        .create(ApodProxyService.class);
  }

}
