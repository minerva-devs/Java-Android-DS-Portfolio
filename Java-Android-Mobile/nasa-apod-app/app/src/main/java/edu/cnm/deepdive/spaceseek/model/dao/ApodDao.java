package edu.cnm.deepdive.spaceseek.model.dao;

import androidx.lifecycle.LiveData;
import androidx.room.Dao;
import androidx.room.Insert;
import androidx.room.OnConflictStrategy;
import androidx.room.Query;
import edu.cnm.deepdive.spaceseek.model.entity.Apod;
import io.reactivex.rxjava3.core.Completable;
import java.time.LocalDate;
import java.util.List;

//@Dao annotation indicates that this interface will define methods for interacting with the database.
@Dao
public interface ApodDao {

  // insert Method inserts a single Apod.
// OnConflictStrategy will ignore insert operation/no data updated if trying to insert an Apod with same ID as existing one.
// Returns Completable used to handle completion of the insert method.
  @Insert(onConflict = OnConflictStrategy.IGNORE)
  Completable insert(List<Apod> apods);

  // insert Method to insert list of Apods
  @Insert(onConflict = OnConflictStrategy.IGNORE)
  Completable insert(Apod apod);

  // deleteAll Method deletes all records from the apod table
// Returns Completable to handle completion of delete method.
  @Query("DELETE FROM apod")
  Completable deleteAll();

  // select(long id) method retrieves apod by its ID.
// Returns LiveData objects: meaning data will be observed & updated automatically when db changes.
  @Query("SELECT * FROM apod WHERE apod_id = :id")
  LiveData<Apod> select(long id);

  // Retrieves apod by its date. Returns LiveData object to observe & update.
  @Query("SELECT * FROM apod WHERE date = :date")
  LiveData<Apod> select(LocalDate date);

  // Retrieves list of apods within a date range date. Returns LiveData object.
  @Query("SELECT * FROM apod WHERE date >= :startDate AND date < :endDate ORDER BY date ASC")
  LiveData<List<Apod>> selectRange(LocalDate startDate, LocalDate endDate);

  // Retrieves list of Apods starting from given :startDate. Returns LiveData object.
  @Query("SELECT * FROM apod WHERE date >= :startDate ORDER BY date ASC")
  LiveData<List<Apod>> selectOpenRange(LocalDate startDate);

  // Retrieves list of favorite apod entities.
  @Query("SELECT * FROM apod WHERE is_favorite")
  LiveData<List<Apod>> getFavorites();

}
