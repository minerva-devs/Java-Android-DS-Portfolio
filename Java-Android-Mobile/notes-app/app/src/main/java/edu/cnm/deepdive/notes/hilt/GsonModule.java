package edu.cnm.deepdive.notes.hilt;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import dagger.Module;
import dagger.Provides;
import dagger.hilt.InstallIn;
import dagger.hilt.components.SingletonComponent;
import javax.inject.Singleton;

@Module
@InstallIn(SingletonComponent.class)
public class GsonModule {

  @Provides
  @Singleton
  Gson provideGson() {
    // TODO: 2/17/25 Create a GsonBuilder and invoke methods to configure it and build an
    //  instance of Gson.
    return new GsonBuilder() //the builder method doesnt have to use the fluent style but it does.
        // the fluent style- where every method we invoke returns the same type of object
        .excludeFieldsWithoutExposeAnnotation()
        .create();

  }

}
