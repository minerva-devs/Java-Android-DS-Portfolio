package edu.cnm.deepdive.spaceseek.service;

import android.content.Context;
import android.content.Intent;
import android.util.Log;
import androidx.activity.result.ActivityResult;
import androidx.activity.result.ActivityResultLauncher;
import com.google.android.gms.auth.api.signin.GoogleSignIn;
import com.google.android.gms.auth.api.signin.GoogleSignInAccount;
import com.google.android.gms.auth.api.signin.GoogleSignInClient;
import com.google.android.gms.auth.api.signin.GoogleSignInOptions;
import com.google.android.gms.common.api.ApiException;
import dagger.hilt.android.qualifiers.ApplicationContext;
import io.reactivex.rxjava3.core.Completable;
import io.reactivex.rxjava3.core.Single;
import io.reactivex.rxjava3.core.SingleEmitter;
import io.reactivex.rxjava3.schedulers.Schedulers;
import javax.inject.Inject;
import javax.inject.Singleton;

/**
 * @noinspection deprecation
 */
@Singleton
public class AuthService {

  private final GoogleSignInClient client;

  @Inject
  public AuthService(@ApplicationContext Context context) {
    GoogleSignInOptions options = new GoogleSignInOptions.Builder(
        GoogleSignInOptions.DEFAULT_SIGN_IN)
        .requestEmail()
        .requestProfile()
        .build();
    client = GoogleSignIn.getClient(context, options);
  }

  /**
   * Returns the GoogleSignInClient instance used for managing sign-in flow.
   */
  public GoogleSignInClient getSignInClient() {
    return client;
  }

  /**
   * Performs a silent sign-in and emits the GoogleSignInAccount if successful. Emits an error
   * otherwise.
   */
  public Single<GoogleSignInAccount> silentSignIn() {
    return Single.create((SingleEmitter<GoogleSignInAccount> emitter) -> {
      client.silentSignIn()
          .addOnSuccessListener(emitter::onSuccess)
          .addOnFailureListener(e -> {
            if (e instanceof ApiException) {
              Log.e("AuthError", "Silent sign-in failed: " + ((ApiException) e).getStatusCode());
            } else {
              Log.e("AuthError", "Unknown sign-in failure", e);
            }
            emitter.onError(e);
          });
    }).subscribeOn(Schedulers.io());
  }


  /**
   * Launches the Google Sign-In intent using the provided ActivityResultLauncher.
   *
   * @param launcher ActivityResultLauncher used to start the sign-in flow.
   */
  public void startSignIn(ActivityResultLauncher<Intent> launcher) {
    launcher.launch(client.getSignInIntent());
  }

  /**
   * Completes the Google Sign-In flow, retrieving the result from the ActivityResult. Emits the
   * signed-in account or an error via RxJava's Single.
   *
   * @param result ActivityResult containing the sign-in result data.
   * @return Single emitting the signed-in account or an error.
   */
  public Single<GoogleSignInAccount> completeSignIn(ActivityResult result) {
    return Single.create((SingleEmitter<GoogleSignInAccount> emitter) -> {
      try {
        GoogleSignInAccount account = GoogleSignIn.getSignedInAccountFromIntent(result.getData())
            .getResult(ApiException.class);
        emitter.onSuccess(account);
      } catch (ApiException e) {
        emitter.onError(e);
      } catch (Exception e) {
        Log.e("AuthError", "Unexpected sign-in error", e);
        emitter.onError(e);
      }
    }).subscribeOn(Schedulers.io());
  }

  /**
   * Signs out the currently signed-in user and emits a completion signal upon success, or an error
   * signal if the operation fails.
   *
   * @return Completable for the sign-out operation.
   */
  public Completable signOut() {
    return Completable.create((emitter) -> {
      client.signOut()
          .addOnSuccessListener((ignored) -> emitter.onComplete())
          .addOnFailureListener(e -> {
            Log.e("AuthError", "Sign-out failed", e);
            emitter.onError(e);
          });
    }).subscribeOn(Schedulers.io());
  }

}
