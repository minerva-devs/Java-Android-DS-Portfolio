package edu.cnm.deepdive.notes.service;

import android.content.Context;
import android.net.Uri;
import androidx.room.Database;
import androidx.room.Room;
import androidx.room.RoomDatabase;
import androidx.room.TypeConverter;
import androidx.room.TypeConverters;
import edu.cnm.deepdive.notes.model.dao.NoteDao;
import edu.cnm.deepdive.notes.model.dao.UserDao;
import edu.cnm.deepdive.notes.model.entity.Note;
import edu.cnm.deepdive.notes.model.entity.User;
import edu.cnm.deepdive.notes.service.NotesDatabase.Converters;
import java.time.Instant;

@Database(entities = {Note.class, User.class}, version = NotesDatabase.VERSION)
@TypeConverters(Converters.class)
public abstract class NotesDatabase extends RoomDatabase {

  static final int VERSION = 1;
  private static final String DATABASE_NAME = "notes";

  public static String getDatabaseName() {
    return DATABASE_NAME;
  }

  public abstract NoteDao getNoteDao();

  public abstract UserDao getUserDao();

  //pure utility class
  public static class Converters {

    //we're telling .room  to convert instant to a Long type in order to use during compile time
    @TypeConverter
    public static Long fromInstant(Instant value) {
      return (value != null) ? value.toEpochMilli() : null;
    }

    //this is the reverse operation from above, we're converting back to Instant in order to build
    //not inside the method, but it is inside the NotesDatabase Class
    @TypeConverter
    public static Instant fromLong(Long value) {
      return (value != null) ? Instant.ofEpochMilli(value) : null;
    }

    @TypeConverter
    public static String fromUri(Uri value) {
      return (value != null) ? value.toString() : null;
    }

  //Give .room a converter for String to Uri
    @TypeConverter
    public static Uri fromString(String value) {
      return (value != null) ? Uri.parse(value) : null;
    }

  }

}
