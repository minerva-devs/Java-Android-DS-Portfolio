package edu.cnm.deepdive.notes.service;

import com.google.android.gms.auth.api.signin.GoogleSignInAccount;
import edu.cnm.deepdive.notes.model.dao.UserDao;
import edu.cnm.deepdive.notes.model.entity.User;
import io.reactivex.rxjava3.core.Scheduler;
import io.reactivex.rxjava3.core.Single;
import io.reactivex.rxjava3.schedulers.Schedulers;
import javax.inject.Inject;
import javax.inject.Singleton;

@Singleton
public class UserRepository {

  private final GoogleSignInService signInService;
  private final UserDao userDao;
  private final Scheduler scheduler;

  @Inject
  UserRepository(GoogleSignInService signInService, UserDao userDao) {
    this.signInService = signInService;
    this.userDao = userDao;
    scheduler = Schedulers.io();
  }

  //this is invoking a piece of machinery
  public Single<GoogleSignInAccount> getCurrentAccount() {
    return signInService
        .refresh()
        .observeOn(scheduler);
  }

  /**
   * @noinspection UnnecessaryParentheses
   */ //we attach this internal machine to getCurrentAmount machine/method
  public Single<User> getCurrentUser() {
    return getCurrentAccount()
        .flatMap((account) -> {
          String oauthKey = account.getId();
          return userDao
              .select(oauthKey)
              .switchIfEmpty(
                  Single.fromSupplier(User::new)
                      .doOnSuccess((user) -> {
                        user.setOauthKey(oauthKey);
                        user.setDisplayName(account.getDisplayName());
                      })
                      .flatMap(userDao::insertAndReturn)
              );
        });
  }
}
