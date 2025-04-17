package edu.cnm.deepdive.farkle.viewmodel;

import android.util.Log;
import androidx.annotation.NonNull;
import androidx.lifecycle.DefaultLifecycleObserver;
import androidx.lifecycle.LifecycleOwner;
import androidx.lifecycle.LiveData;
import androidx.lifecycle.MutableLiveData;
import androidx.lifecycle.ViewModel;
import dagger.hilt.android.lifecycle.HiltViewModel;
import edu.cnm.deepdive.farkle.model.dto.Game;
import edu.cnm.deepdive.farkle.model.dto.RollAction;
import edu.cnm.deepdive.farkle.model.dto.User;
import edu.cnm.deepdive.farkle.service.GameService;
import io.reactivex.rxjava3.disposables.CompositeDisposable;
import java.util.List;
import javax.inject.Inject;

@HiltViewModel
public class GameViewModel extends ViewModel implements DefaultLifecycleObserver {

  private static final String TAG = GameViewModel.class.getSimpleName();

  private final MutableLiveData<Game> game;
  private final MutableLiveData<User> user;
  private final MutableLiveData<Boolean> continueTurn;
  private final MutableLiveData<Throwable> throwable;
  private final GameService gameService;
  private final CompositeDisposable pending;
  private LiveData<Boolean> quitGame;

  @Inject
  public GameViewModel(GameService gameService) {
    this.gameService = gameService;
    game = new MutableLiveData<>();
    user = new MutableLiveData<>();
    continueTurn = new MutableLiveData<>();
    throwable = new MutableLiveData<>();
    pending = new CompositeDisposable();
    fetchUser();
  }

  public LiveData<Game> getGame() {
    return game;
  }

  public LiveData<User> getUser() {
    return user;
  }

  public MutableLiveData<Boolean> getContinueTurn() {
    return continueTurn;
  }

  public LiveData<Throwable> getThrowable() {
    return throwable;
  }

  public void startOrJoin() {
    throwable.setValue(null);
    gameService
        .startOrJoin()
        .subscribe(
            (game) -> {
              this.game.postValue(game);
              fetchGame(game);
            },
            this::postThrowable,
            pending
        );
  }

  public void submitRollChoice(List<int[]> frozenGroups, boolean finished) {
    RollAction rollAction = new RollAction(frozenGroups, finished);
    //noinspection DataFlowIssue
    gameService.freezeOrContinue(game.getValue().getKey(), rollAction)
        .subscribe(
            continueTurn::postValue,
            this::postThrowable,
            pending
        );
  }

  public void fetchGame(Game game) {
    throwable.postValue(null);
    gameService.getGame(game.getKey(), game.getState(), game.getRollCount())
        .subscribe(
            (g) -> {
              this.game.postValue(g);
              fetchGame(g);
            },
            this::postThrowable,
            pending
        );
  }

  private void fetchUser() {
    throwable.postValue(null);
    gameService.getUser()
        .subscribe(
            user::postValue,
            this::postThrowable,
            pending
        );
  }

  public LiveData<Boolean> getQuitGame() {
    return quitGame;
  }

  @Override
  public void onStop(@NonNull LifecycleOwner owner) {
    pending.clear();
    DefaultLifecycleObserver.super.onStop(owner);
  }

  private void postThrowable(Throwable throwable) {
    Log.e(TAG, throwable.getMessage(), throwable);
    this.throwable.postValue(throwable);
  }
}

