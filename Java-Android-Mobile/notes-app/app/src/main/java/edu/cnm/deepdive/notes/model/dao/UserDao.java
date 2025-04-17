package edu.cnm.deepdive.notes.model.dao;

import androidx.lifecycle.LiveData;
import androidx.room.Dao;
import androidx.room.Delete;
import androidx.room.Insert;
import androidx.room.Query;
import androidx.room.Transaction;
import androidx.room.Update;
import edu.cnm.deepdive.notes.model.entity.User;
import edu.cnm.deepdive.notes.model.pojo.UserWithNotes;
import io.reactivex.rxjava3.core.Completable;
import io.reactivex.rxjava3.core.Maybe;
import io.reactivex.rxjava3.core.Single;

@Dao
public interface UserDao {

  @Insert
  Single<Long> insert(
      User user); //this method doesn't return a single, it's a machinery that returns a long

  //this is a diff version to return id
  default Single<User> insertAndReturn(User user) {
    return insert(user)
        .map((id) -> {
          user.setId(id);
          return user;
        });
  }

  @Update
  Completable update(User user);

  //completable is a success event that passes down data, with this can delete multiple users at once
  @Delete
  Completable delete(User... users);

  @Query("SELECT * FROM user WHERE user_id = :id")
  LiveData<User> select(long id);

  @Transaction
  @Query("SELECT * FROM user WHERE user_id = :id")
  LiveData<UserWithNotes> selectWithNotes(long id);

  @Query("SELECT * FROM user WHERE oauth_key = :oauthKey")
  Maybe<User> select(String oauthKey);

}
