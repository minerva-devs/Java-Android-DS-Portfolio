package edu.cnm.deepdive.spaceseek.viewmodel;

import android.app.Application;
import android.content.Intent;
import androidx.activity.result.ActivityResult;
import androidx.activity.result.ActivityResultLauncher;
import androidx.annotation.NonNull;
import androidx.lifecycle.AndroidViewModel;
import androidx.lifecycle.DefaultLifecycleObserver;
import androidx.lifecycle.LiveData;
import androidx.lifecycle.MutableLiveData;
import com.google.android.gms.auth.api.signin.GoogleSignInAccount;
import dagger.hilt.android.lifecycle.HiltViewModel;
import edu.cnm.deepdive.spaceseek.service.AuthService;
import io.reactivex.rxjava3.android.schedulers.AndroidSchedulers;
import io.reactivex.rxjava3.schedulers.Schedulers;
import javax.inject.Inject;

/**
 * @noinspection deprecation
 */
@HiltViewModel
public class LoginViewModel extends AndroidViewModel implements DefaultLifecycleObserver {

  private final AuthService authService;
  private final MutableLiveData<GoogleSignInAccount> account = new MutableLiveData<>();
  private final MutableLiveData<Throwable> signInThrowable = new MutableLiveData<>();
  private final MutableLiveData<Throwable> refreshThrowable = new MutableLiveData<>();

  @Inject
  public LoginViewModel(@NonNull Application application, AuthService authService) {
    super(application);
    this.authService = authService;
  }

  public LiveData<GoogleSignInAccount> getAccount() {
    return account;
  }

  public LiveData<Throwable> getSignInThrowable() {
    return signInThrowable;
  }

  public LiveData<Throwable> getRefreshThrowable() {
    return refreshThrowable;
  }

  public void refresh() {
    authService.silentSignIn()
        .subscribeOn(Schedulers.io())
        .observeOn(AndroidSchedulers.mainThread())
        .subscribe(
            this::setAccount,
            this::setRefreshThrowable
        );
  }

  public void startSignIn(ActivityResultLauncher<Intent> launcher) {
    launcher.launch(authService.getSignInClient().getSignInIntent());
  }

  public void completeSignIn(ActivityResult result) {
    authService.completeSignIn(result)
        .subscribeOn(Schedulers.io())
        .observeOn(AndroidSchedulers.mainThread())
        .subscribe(
            this::setAccount,
            this::setSignInThrowable
        );
  }

  public void signOut() {
    authService.signOut()
        .subscribeOn(Schedulers.io())
        .observeOn(AndroidSchedulers.mainThread())
        .subscribe(
            () -> account.postValue(null),
            this::setSignInThrowable
        );
  }

  private void setAccount(GoogleSignInAccount account) {
    this.account.postValue(account);
    signInThrowable.postValue(null);
    refreshThrowable.postValue(null);
  }

  private void setSignInThrowable(Throwable throwable) {
    signInThrowable.postValue(throwable);
  }

  private void setRefreshThrowable(Throwable throwable) {
    refreshThrowable.postValue(throwable);
  }
}