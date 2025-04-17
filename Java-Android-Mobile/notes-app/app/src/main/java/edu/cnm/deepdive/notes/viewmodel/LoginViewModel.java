package edu.cnm.deepdive.notes.viewmodel;

import static android.content.ContentValues.TAG;

import android.content.Intent;
import android.util.Log;
import androidx.activity.result.ActivityResult;
import androidx.activity.result.ActivityResultLauncher;
import androidx.annotation.NonNull;
import androidx.lifecycle.DefaultLifecycleObserver;
import androidx.lifecycle.LifecycleOwner;
import androidx.lifecycle.LiveData;
import androidx.lifecycle.MutableLiveData;
import androidx.lifecycle.ViewModel;
import com.google.android.gms.auth.api.signin.GoogleSignInAccount;
import dagger.hilt.android.lifecycle.HiltViewModel;
import edu.cnm.deepdive.notes.service.GoogleSignInService;
import io.reactivex.rxjava3.disposables.CompositeDisposable;
import javax.inject.Inject;

/** @noinspection deprecation*/
@HiltViewModel
public class LoginViewModel extends ViewModel implements DefaultLifecycleObserver {

  private final GoogleSignInService signInService;
  private final MutableLiveData<GoogleSignInAccount> account;
  private final MutableLiveData<Throwable> refreshThrowable;
  private final MutableLiveData<Throwable> signInThrowable;
  private final CompositeDisposable pending;


  @Inject
  LoginViewModel(GoogleSignInService signInService) {
    this.signInService = signInService;
    account = new MutableLiveData<>();
    refreshThrowable = new MutableLiveData<>();
    signInThrowable = new MutableLiveData<>();
    pending = new CompositeDisposable();
  }

  public LiveData<GoogleSignInAccount> getAccount() {return account;}

  public LiveData<Throwable> getRefreshThrowable() {
    return refreshThrowable;
  }

  public LiveData<Throwable> getSignInThrowable() {
    return signInThrowable;
  }

  //consumer of a successful result, of the data returned, but doesn't return anything in exchange, which is what a listener does
  public void refresh() {
    refreshThrowable.setValue(null);
    signInThrowable.setValue(null);
    signInService
        .refresh()
        .subscribe(
            account::postValue,
            (throwable) -> postThrowable(throwable, this.refreshThrowable),
            pending
        );
  }

  public void startSignIn(ActivityResultLauncher<Intent> launcher) {
    refreshThrowable.setValue(null);
    signInThrowable.setValue(null);
    signInService.startSignIn(launcher);
  }

  public void completeSignIn(ActivityResult result) {
    refreshThrowable.setValue(null);
    signInThrowable.setValue(null);
    signInService
        .completeSignIn(result)
        .subscribe(
            account::postValue,
            (throwable) -> postThrowable(throwable, signInThrowable),
            pending
        );
  }

  //an action is a functional interface ie doFinally()
  public void signOut() {
    refreshThrowable.setValue(null);
    signInThrowable.setValue(null);
    signInService
        .signOut()
        .doFinally(() -> account.postValue(null))
        .subscribe();
  }

  @Override
  public void onStop(@NonNull LifecycleOwner owner) {
    pending.clear();
    DefaultLifecycleObserver.super.onStop(owner);
  }

  private void postThrowable(Throwable throwable, MutableLiveData<Throwable> ThrowableLiveData) {
    Log.e(TAG, throwable.getMessage(), throwable);
    ThrowableLiveData.postValue(throwable);
  }


}
