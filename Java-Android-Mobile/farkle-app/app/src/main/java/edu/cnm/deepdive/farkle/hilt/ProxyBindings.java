package edu.cnm.deepdive.farkle.hilt;

import com.google.gson.JsonDeserializer;
import dagger.Binds;
import dagger.Module;
import dagger.hilt.InstallIn;
import dagger.hilt.components.SingletonComponent;
import edu.cnm.deepdive.farkle.adapter.InstantDeserializer;
import java.time.Instant;

@Module
@InstallIn(SingletonComponent.class)
public interface ProxyBindings {

  @Binds
  JsonDeserializer<Instant> bindJsonDeserializer(InstantDeserializer deserializer);

}