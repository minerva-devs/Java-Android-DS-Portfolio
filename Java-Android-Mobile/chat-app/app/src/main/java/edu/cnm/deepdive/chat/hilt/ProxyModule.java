package edu.cnm.deepdive.chat.hilt;


import android.content.Context;
import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonDeserializer;
import dagger.Module;
import dagger.Provides;
import dagger.hilt.InstallIn;
import dagger.hilt.android.qualifiers.ApplicationContext;
import dagger.hilt.components.SingletonComponent;
import edu.cnm.deepdive.chat.R;
import edu.cnm.deepdive.chat.service.ChatServiceLongPollingProxy;
import edu.cnm.deepdive.chat.service.ChatServiceProxy;
import java.time.Duration;
import java.time.Instant;
import javax.inject.Inject;
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

  @Inject
  ProxyModule() {
  }

  //writing methods to build GSON object, ie register type adapter, for deserializing incoming and outgoing data.
//we will only pay attention to fields with @Expose annotation
//create builder objects (GsonBuilder) and invoke methods on the builder object (.exclude, .create, etc),
// to return the object we want to build
  @Provides
  @Singleton
  Gson provideGson(JsonDeserializer<Instant> deserializer) {
    return new GsonBuilder()
        .registerTypeAdapter(Instant.class, deserializer)
        .excludeFieldsWithoutExposeAnnotation() //returns fields we've created already
        .create();  //returns new fields
  }

  @Provides
  @Singleton
  Interceptor provideInterceptor(Gson gson, @ApplicationContext Context context) {
    return new HttpLoggingInterceptor()
        .setLevel(Level.valueOf(context.getString(R.string.log_level).toUpperCase()));
  }

  //**invoke methods on Builder class
  //Builder pattern is used in objects with lots of configuration options
  //Allows us to create a new builder object ready to go instead of creating getters/setter = OkHttpClient.Builder()
  //The object invokes methods, methods return object which has the ability to construct as needed = .addInterceptor(interceptor)
  //We're programming to the interface ChatServiceProxy
  @Provides
  @Singleton
  ChatServiceProxy provideProxy(
      @ApplicationContext Context context, Gson gson, Interceptor interceptor) {
    OkHttpClient client = new OkHttpClient.Builder()
        .addInterceptor(interceptor)
        .build();
    return new Retrofit.Builder()
        .client(client)
        .addConverterFactory(GsonConverterFactory.create(gson))
        .addCallAdapterFactory(RxJava3CallAdapterFactory.create())
        .baseUrl(context.getString(R.string.base_url))
        .build()
        .create(ChatServiceProxy.class);
  }

  //this builds an instance of our interface ChatServiceLongPollingProxy
  //from return new Retrofit.Builder() to--> .create(ChatServiceLongPollingProxy.class);
  //default callTimeout is 10 min
  @Provides
  @Singleton
  ChatServiceLongPollingProxy provideLongPollingProxy(
      @ApplicationContext Context context, Gson gson, Interceptor interceptor) {
    OkHttpClient client = new OkHttpClient.Builder()
        .addInterceptor(interceptor)
        .connectTimeout(Duration.ZERO)
        .writeTimeout(Duration.ZERO)
        .readTimeout(Duration.ZERO)
        .callTimeout(Duration.ofSeconds(30))
        .build();
    return new Retrofit.Builder()
        .client(client)
        .addConverterFactory(GsonConverterFactory.create(gson))
        .addCallAdapterFactory(RxJava3CallAdapterFactory.create())
        .baseUrl(context.getString(R.string.base_url))
        .build()
        .create(ChatServiceLongPollingProxy.class);
  }

}
