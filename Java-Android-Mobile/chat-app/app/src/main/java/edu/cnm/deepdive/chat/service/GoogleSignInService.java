package edu.cnm.deepdive.chat.service;

import android.content.Context;
import android.content.Intent;
import androidx.activity.result.ActivityResult;
import androidx.activity.result.ActivityResultLauncher;
import com.google.android.gms.auth.api.signin.GoogleSignIn;
import com.google.android.gms.auth.api.signin.GoogleSignInAccount;
import com.google.android.gms.auth.api.signin.GoogleSignInClient;
import com.google.android.gms.auth.api.signin.GoogleSignInOptions;
import com.google.android.gms.common.api.ApiException;
import dagger.hilt.android.qualifiers.ApplicationContext;
import edu.cnm.deepdive.chat.R;
import io.reactivex.rxjava3.core.Completable;
import io.reactivex.rxjava3.core.Single;
import io.reactivex.rxjava3.core.SingleEmitter;
import io.reactivex.rxjava3.schedulers.Schedulers;
import javax.inject.Inject;
import javax.inject.Singleton;

/** @noinspection deprecation*/
@Singleton
public class GoogleSignInService {

  private final GoogleSignInClient client;

  @Inject
  GoogleSignInService(@ApplicationContext Context context) {
    GoogleSignInOptions options = new GoogleSignInOptions.Builder()
        .requestEmail()
        .requestProfile()
        .requestId()
        .requestIdToken(context.getString(R.string.client_id))
        .build();
    client = GoogleSignIn.getClient(context, options);
  }

  //silent sign in
  public Single<GoogleSignInAccount> refresh() {
    return Single.create((SingleEmitter<GoogleSignInAccount> emitter) ->
            client
                .silentSignIn()
                .addOnSuccessListener(emitter::onSuccess)
                .addOnFailureListener(emitter::onError)
        )
        .observeOn(Schedulers.io());
  }

  //account is the object we're invoking the getIdToken() method on
  public Single<String> refreshBearerToken() {
    return refresh()
        .map(googleSignInAccount ->
            googleSignInAccount.getIdToken());
  }

  //if silent sign in doesn't occur, intentional sign in cues up to start login
  //there's a callback in the launcher activity
  public void startSignIn(ActivityResultLauncher<Intent> launcher) {
    launcher.launch(client.getSignInIntent());
  }

  //this completes the sign in
  public Single<GoogleSignInAccount> completeSignIn(ActivityResult result) {
    return Single.create((SingleEmitter<GoogleSignInAccount> emitter) -> {
          try {
            GoogleSignInAccount account =
                GoogleSignIn.getSignedInAccountFromIntent(result.getData())
                    .getResult(ApiException.class);
            emitter.onSuccess(account);
          } catch (ApiException e) {
            emitter.onError(e);
          }
        })
        .observeOn(Schedulers.io());
  }

  //log out method
  public Completable signOut() {
    return Completable.create((emitter) ->
            client
                .signOut()
                .addOnSuccessListener((ignored) -> emitter.onComplete())
                .addOnFailureListener(emitter::onError)
        )
        .observeOn(Schedulers.io());
  }


}
