package edu.cnm.deepdive.farkle.viewmodel;

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
import edu.cnm.deepdive.farkle.service.GoogleSignInService;
import io.reactivex.rxjava3.disposables.CompositeDisposable;
import javax.inject.Inject;

/**
 * @noinspection deprecation
 */
@HiltViewModel
public class LoginViewModel extends ViewModel implements DefaultLifecycleObserver {

  private static final String TAG = LoginViewModel.class.getSimpleName();

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

  public LiveData<GoogleSignInAccount> getAccount() {
    return account;
  }

  public LiveData<Throwable> getRefreshThrowable() {
    return refreshThrowable;
  }

  public LiveData<Throwable> getSignInThrowable() {
    return signInThrowable;
  }

  public void refresh() {
    refreshThrowable.setValue(null);
    signInThrowable.setValue(null);
    signInService
        .refresh()
        .subscribe(
            account::postValue,
            (throwable) -> postThrowable(throwable, refreshThrowable),
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

  private void postThrowable(Throwable throwable, MutableLiveData<Throwable> throwableLiveData) {
    Log.e(TAG, throwable.getMessage(), throwable);
    throwableLiveData.postValue(throwable);
  }

}
