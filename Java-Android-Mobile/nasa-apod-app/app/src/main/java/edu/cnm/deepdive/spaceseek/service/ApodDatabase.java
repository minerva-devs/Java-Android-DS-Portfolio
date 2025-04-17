package edu.cnm.deepdive.spaceseek.service;

import androidx.room.Database;
import androidx.room.RoomDatabase;
import androidx.room.TypeConverter;
import androidx.room.TypeConverters;
import edu.cnm.deepdive.spaceseek.model.dao.ApodDao;
import edu.cnm.deepdive.spaceseek.model.entity.Apod;
import edu.cnm.deepdive.spaceseek.model.entity.Apod.MediaType;
import edu.cnm.deepdive.spaceseek.service.ApodDatabase.Converters;
import java.net.MalformedURLException;
import java.net.URI;
import java.net.URISyntaxException;
import java.net.URL;
import java.time.LocalDate;

@Database(entities = {Apod.class}, version = ApodDatabase.VERSION)
@TypeConverters({Converters.class})
public abstract class ApodDatabase extends RoomDatabase {

  static final int VERSION = 1;
  private static final String NAME = "apod";

  public static String getName() {
    return NAME;
  }

  public abstract ApodDao getApodDao();

  public static class Converters {

    @TypeConverter
    public static Long localDateToLong(LocalDate value) {
      return (value != null) ? value.toEpochDay() : null;
    }

    @TypeConverter
    public static LocalDate longToLocalDate(Long value) {
      return (value != null) ? LocalDate.ofEpochDay(value) : null;
    }

    @TypeConverter
    public static Integer mediaTypeToInteger(MediaType value) {
      return (value != null) ? value.ordinal() : null;
    }

    @TypeConverter
    public static MediaType integerToMediaType(Integer value) {
      return (value != null) ? MediaType.values()[value] : null;
    }

    @TypeConverter
    public static String urlToString(URL value) {
      return (value != null) ? value.toString() : null;
    }

    @TypeConverter
    public static URL stringToUrl(String value) throws URISyntaxException, MalformedURLException {
      return (value != null) ? new URI(value).toURL() : null;
    }
  }


}
