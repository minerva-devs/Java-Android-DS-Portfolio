package edu.cnm.deepdive.chat.hilt;


import com.google.gson.JsonDeserializer;
import dagger.Binds;
import dagger.Module;
import dagger.hilt.InstallIn;
import dagger.hilt.components.SingletonComponent;
import edu.cnm.deepdive.chat.InstantDeserializer;
import java.time.Instant;

@Module
@InstallIn(SingletonComponent.class)
public interface ProxyBindings {

  @Binds
  JsonDeserializer<Instant> bindJsonDeserializer(InstantDeserializer deserializer);

}

//binds methods always abstract
//provides methods always concrete