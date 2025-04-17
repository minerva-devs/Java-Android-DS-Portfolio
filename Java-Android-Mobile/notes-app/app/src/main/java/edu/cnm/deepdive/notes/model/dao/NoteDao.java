package edu.cnm.deepdive.notes.model.dao;

import androidx.lifecycle.LiveData;
import androidx.room.Dao;
import androidx.room.Delete;
import androidx.room.Insert;
import androidx.room.Query;
import androidx.room.Transaction;
import androidx.room.Update;
import edu.cnm.deepdive.notes.model.entity.Note;
import edu.cnm.deepdive.notes.model.pojo.NoteWithUser;
import io.reactivex.rxjava3.core.Completable;
import io.reactivex.rxjava3.core.Single;
import java.time.Instant;
import java.util.Collection;
import java.util.List;

@Dao
public interface NoteDao {

  @Insert
  Single<Long> insert(Note note);

  //we are creating this instead of .room doing it, so it does not need an @Insert annotation
  //we take the Note that was created upstream, then use the machinery to pass the note downstream with another
  // processing station hooked on to the id
  default Single<Note> insertAndReturn(Note note) {
    return insert(note)
        .map((id) -> {
          note.setId(id);
          return note;
        });
  }

  //All these methods return machines
  //will assume Note will contain a key value
  @Insert
  Single<List<Long>> insert(Collection<Note> notes);

  @Insert
  Single<List<Long>> insert(Note... notes);

  //Passes downstream only the completion of event but not data.
  //So it won't pass anything if nothing was modified.
  @Update
  Completable update(Note note);

  @Update
  Completable update(Collection<Note> notes);

  @Update
  Completable update(Note... notes);

  @Delete
  Completable delete(Note note);

  @Delete
  Completable delete(Collection<Note> notes);

  @Delete
  Completable delete(Note... notes);

  @Query("SELECT * FROM note WHERE note_id = :id")
  LiveData<Note> selectById(long id);

  //Will not use ReactiveX machinery for Query, we'll use LiveData.
  //LiveData in .room - will Get a piece of LiveData from Spring
  //1.Query, 2.Method, 3.Parameters()

  @Query("SELECT * FROM note ORDER BY created_on ASC")
  LiveData<List<Note>> selectByCreatedOnAsc();

  @Query("SELECT * FROM note ORDER BY created_on DESC")
  LiveData<List<Note>> selectByCreatedOnDesc();

  //WHERE FILTER/Clause always comes before the ORDER BY sort

  @Query("SELECT * FROM note WHERE created_on >= :rangeStart AND created_on < :rangeEnd ORDER BY created_on ASC")
  LiveData<List<Note>> selectWhereCreatedOnInRangeByCreatedOnAsc(Instant rangeStart,
      Instant rangeEnd);

  @Query("SELECT * FROM note ORDER BY title ASC")
  LiveData<List<Note>> selectByTitleAsc();

  @Query("SELECT * FROM note ORDER BY title DESC")
  LiveData<List<Note>> selectByTitleDesc();

  //This statement will be presented with a question mark to each of the engines to find out the data type
  // so the output will be passed as a String filter per parameter bc we have designated it as such.
  //so you have to do SQL Querying with prepared statements- aka the query.
  @Transaction
  @Query("SELECT * FROM note WHERE title LIKE :filter ORDER BY title ASC")
  LiveData<List<NoteWithUser>> selectWhereTitleLikeByTitleAsc(String filter);

  @Query("SELECT * FROM note WHERE user_id = :userId ORDER BY created_on ASC")
  LiveData<List<Note>> selectByUserId(long userId);
}
