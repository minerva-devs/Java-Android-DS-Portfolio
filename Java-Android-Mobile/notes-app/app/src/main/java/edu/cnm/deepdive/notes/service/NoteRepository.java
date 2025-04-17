package edu.cnm.deepdive.notes.service;

import androidx.lifecycle.LiveData;
import edu.cnm.deepdive.notes.model.dao.NoteDao;
import edu.cnm.deepdive.notes.model.entity.Note;
import edu.cnm.deepdive.notes.model.entity.User;
import io.reactivex.rxjava3.core.Completable;
import io.reactivex.rxjava3.core.Scheduler;
import io.reactivex.rxjava3.core.Single;
import io.reactivex.rxjava3.schedulers.Schedulers;
import java.time.Instant;
import java.util.List;
import javax.inject.Inject;
import javax.inject.Singleton;

@Singleton
public class NoteRepository {

  private final NoteDao noteDao;
  private final Scheduler scheduler;

  @Inject
  NoteRepository(NoteDao noteDao) {
    this.noteDao = noteDao;
    scheduler = Schedulers.io();
  }

  //a single is a piece of machinery-- Single of note, Single<Note>
  //Non-zero id, take time stamp, pass it downstream
  //with a zero id
  //the view model will invoke the machine Single<Note>
  public Single<Note> save(Note note) {
    return (note.getId() != 0)
        ? Completable.fromAction(() -> note.setModifiedOn(Instant.now()))
        .andThen(noteDao.update(note))
        .toSingle(() -> note)
        .subscribeOn(scheduler)
        : noteDao
            .insertAndReturn(note)
            .subscribeOn(scheduler);
  }

  public LiveData<Note> get(long id) {
    return noteDao.selectById(id);
  }

  //remove returns reactiveX
  public Completable remove(Note note) {
    return noteDao
        .delete(note)
        .subscribeOn(scheduler);
  }

  public LiveData<List<Note>> getAll() {
    return noteDao.selectByCreatedOnAsc();
  }

  public LiveData<List<Note>> getAllForUser(User user) {
    return noteDao.selectByUserId(user.getId());
  }

}
