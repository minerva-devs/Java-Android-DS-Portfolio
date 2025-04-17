package edu.cnm.deepdive.notes.service;

import android.content.Context;
import androidx.annotation.NonNull;
import androidx.room.RoomDatabase;
import androidx.sqlite.db.SupportSQLiteDatabase;
import com.google.gson.Gson;
import dagger.hilt.android.qualifiers.ApplicationContext;
import edu.cnm.deepdive.notes.R;
import edu.cnm.deepdive.notes.model.dao.NoteDao;
import edu.cnm.deepdive.notes.model.entity.Note;
import io.reactivex.rxjava3.schedulers.Schedulers;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.Reader;
import javax.inject.Inject;
import javax.inject.Provider;

public class Preloader extends RoomDatabase.Callback {

  private final Context context;
  private final Provider<NoteDao> noteDaoProvider;
  private final Gson gson;

  //our parameters are our dependencies
  @Inject
  Preloader(@ApplicationContext Context context, Provider<NoteDao> noteDaoProvider, Gson gson) {
    this.context = context;
    this.noteDaoProvider = noteDaoProvider;
    this.gson = gson;
  }

  //the moment this is instantiated, regardless
  // of source of activation, the Preloader is activated to deliver noteDao WHEN and if it is needed
  @Override
  public void onCreate(@NonNull SupportSQLiteDatabase db) {
    super.onCreate(db);

//Provider is a promise to deliver something later, at
// the moment we create the preloader we don't need the noteDao, only a promise
    NoteDao noteDao = noteDaoProvider.get();

//input stream needs to be closed, must use control statement try with resources, it's about
// cleaning up whether an exception occurs or not
    try (
        InputStream input = context.getResources().openRawResource(R.raw.preload);
        Reader reader = new InputStreamReader(input)
    ) {
      Note[] notes = gson.fromJson(reader, Note[].class);
      noteDao
          .insert(notes)
          .subscribeOn(Schedulers.io())
          .subscribe();  //now we can create an instance of this; when the physical database is created // we will insert 2 notes
//any exception terminates the try block, so it has to be closed
    } catch (IOException e) {
      throw new RuntimeException(e);
    }

  }
}
