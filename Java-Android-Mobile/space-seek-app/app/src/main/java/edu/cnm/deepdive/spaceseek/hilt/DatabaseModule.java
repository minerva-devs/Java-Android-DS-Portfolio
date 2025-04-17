package edu.cnm.deepdive.spaceseek.hilt;

import android.content.Context;
import androidx.room.Room;
import dagger.Module;
import dagger.Provides;
import dagger.hilt.InstallIn;
import dagger.hilt.android.qualifiers.ApplicationContext;
import dagger.hilt.components.SingletonComponent;
import edu.cnm.deepdive.spaceseek.model.dao.ApodDao;
import edu.cnm.deepdive.spaceseek.service.ApodDatabase;
import javax.inject.Singleton;

@Module
@InstallIn(SingletonComponent.class)
public class DatabaseModule {

  @Provides
  @Singleton
  ApodDatabase provideDatabase(@ApplicationContext Context context) {
    return Room.databaseBuilder(context, ApodDatabase.class, ApodDatabase.getName())
        .build();
  }

  @Provides
  @Singleton
  ApodDao provideApodDao(ApodDatabase database) {
    return database.getApodDao();
  }

}
