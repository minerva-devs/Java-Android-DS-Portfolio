package edu.cnm.deepdive.notes.viewmodel;

import android.net.Uri;
import android.util.Log;
import androidx.annotation.NonNull;
import androidx.lifecycle.DefaultLifecycleObserver;
import androidx.lifecycle.LifecycleOwner;
import androidx.lifecycle.LiveData;
import androidx.lifecycle.MutableLiveData;
import androidx.lifecycle.Transformations;
import androidx.lifecycle.ViewModel;
import dagger.hilt.android.lifecycle.HiltViewModel;
import edu.cnm.deepdive.notes.model.entity.Note;
import edu.cnm.deepdive.notes.model.entity.User;
import edu.cnm.deepdive.notes.service.NoteRepository;
import edu.cnm.deepdive.notes.service.UserRepository;
import io.reactivex.rxjava3.disposables.CompositeDisposable;
import java.util.List;
import javax.inject.Inject;

@HiltViewModel
public class NoteViewModel extends ViewModel implements DefaultLifecycleObserver {

  private final NoteRepository noteRepository;
  private final UserRepository userRepository;
  private final MutableLiveData<Long> noteId;
  private final LiveData<Note> note;
  private final MutableLiveData<User> user;
  private final MutableLiveData<Uri> captureUri;
  private final MutableLiveData<Throwable> throwable;
  //for pending asynchronous jobs
  private final CompositeDisposable pending;

  private Uri pendingCaptureUri;

  //Constructor
  @Inject
  NoteViewModel(NoteRepository noteRepository, UserRepository userRepository) {
    this.noteRepository = noteRepository;
    this.userRepository = userRepository;
    noteId = new MutableLiveData<>();
    note = Transformations.switchMap(noteId,
        noteRepository::get); //triggers a query & returns live data, the repository passes that along
    //the object we're triggering is noteRepository with id
    user = new MutableLiveData<User>();
    captureUri = new MutableLiveData<>();
    throwable = new MutableLiveData<>();
    pending = new CompositeDisposable();
  }

  public void save(Note note) {
    // DONE: 2/12/25  Reset our throwable livedata.
    throwable.setValue(null);  // Will be invoked from controller on UI thread
    userRepository
        .getCurrentUser()
        .map((user) -> {
          this.user.postValue(user);
          note.setUserId(user.getId());
          return note;
        })
        .flatMap(noteRepository::save)
        .ignoreElement()
        .subscribe(
            () -> {
            },
            this::postThrowable,
            pending
        );
  }

  //will fetch an id
  public void fetch(long noteId) {
    throwable.setValue(null);
    this.noteId.setValue(noteId);
  }
//get invokes action, triggering a chain of things happening

  public void delete(Note note) {
    throwable.setValue(null);
    noteRepository
        .remove(note) //returns a Completable, to turn on the machinery, must subscribe
        .subscribe(
            () -> {
            },
            this::postThrowable,
            pending
        );
  }

  public void confirmCapture(boolean success) {
    captureUri.setValue(success ? pendingCaptureUri : null);
    pendingCaptureUri = null;
  }

  public void clearCaptureUri() {
    captureUri.setValue(null);
  }

  public LiveData<Long> getNoteId() {
    return noteId;
  }

  public LiveData<Note> getNote() {
    return note;
  }


  private void fetchCurrentUser() {
    throwable.setValue(null);
    userRepository
        .getCurrentUser()
        .subscribe(
            user::postValue,
            this::postThrowable,
            pending
        );
  }

  public LiveData<List<Note>> getNotes() {
    fetchCurrentUser();
    //when UI invokes this, it gets live data, when it observes it, query happens
    return Transformations.switchMap(user, noteRepository::getAllForUser);
  }

  public LiveData<Uri> getCaptureUri() {
    return captureUri;
  }

  public LiveData<Throwable> getThrowable() {
    return throwable;
  }

  public void setPendingCaptureUri(Uri pendingCaptureUri) {
    this.pendingCaptureUri = pendingCaptureUri;
  }

  @Override
  public void onStop(@NonNull LifecycleOwner owner) {
    pending.clear();
    DefaultLifecycleObserver.super.onStop(owner);
  }

  private void postThrowable(Throwable throwable) {
    Log.e(NoteViewModel.class.getSimpleName(), throwable.getMessage(), throwable);
    this.throwable.postValue(
        throwable); //this is a consumer of throwable, ONLY for unsuccessful results
  }
}