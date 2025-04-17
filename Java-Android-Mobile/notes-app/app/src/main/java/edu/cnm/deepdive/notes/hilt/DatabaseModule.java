package edu.cnm.deepdive.notes.hilt;

import android.content.Context;
import androidx.room.Room;
import dagger.Module;
import dagger.Provides;
import dagger.hilt.InstallIn;
import dagger.hilt.android.qualifiers.ApplicationContext;
import dagger.hilt.components.SingletonComponent;
import edu.cnm.deepdive.notes.model.dao.NoteDao;
import edu.cnm.deepdive.notes.model.dao.UserDao;
import edu.cnm.deepdive.notes.service.NotesDatabase;
import edu.cnm.deepdive.notes.service.Preloader;
import javax.inject.Singleton;

@Module
@InstallIn(SingletonComponent.class)
public class DatabaseModule {

  //Steps necessary to create instance of NotesDatabase CLASS
  @Provides
  @Singleton

  //Room instantiates NotesDatabase class with method provideDatabase to build wrapper to create
  // structure to store data
  //3 key lifecycle moments: context, notesDatabase class and getDatabaseName.
  NotesDatabase provideDatabase(
      @ApplicationContext Context context) {
    return Room.databaseBuilder(context,
            NotesDatabase.class, NotesDatabase.getDatabaseName())
        // DONE: 2/11/25 Attach callback for database preload.
//        .addCallback(callback)
        .build();

  }

  @Provides
  @Singleton
  NoteDao provideNoteDao(NotesDatabase database) {
    return database.getNoteDao();
  }

  @Provides
  @Singleton
  UserDao provideUserDao(NotesDatabase database) {
    return database.getUserDao();
  }


}

//room is the google support library for  android
