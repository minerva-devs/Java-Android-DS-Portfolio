package edu.cnm.deepdive.farkle.service;

import edu.cnm.deepdive.farkle.model.dao.UserRepository;
import edu.cnm.deepdive.farkle.model.entity.User;
import java.util.UUID;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

@Service
public class UserService implements AbstractUserService {

  private final UserRepository userRepository;

  public UserService(UserRepository userRepository) {
    this.userRepository = userRepository;
  }

  @Override
  public User getCurrent() {
    return (User) SecurityContextHolder.getContext()
        .getAuthentication()
        .getPrincipal();
  }

  @Override
  public User get(UUID externalKey) {
    return userRepository
        .findByExternalKey(externalKey)
        .orElseThrow();
  }

  @Override
  public synchronized User getOrCreate(String authKey, String displayName) {
    return userRepository
        .findByAuthKey(authKey)
        .orElseGet(() -> {
          User user = new User();
          user.setAuthKey(authKey);
          user.setDisplayName(displayName);
          // TODO: 3/5/25 Set avatar.
          return userRepository.save(user);
        });
  }

  @Override
  public User update(User user) {
    return userRepository
        .findById(getCurrent().getId())
        .map((u) -> {
          String displayName = user.getDisplayName();
          if (displayName != null) {
            u.setDisplayName(displayName);
          }
          return userRepository.save(u);
        })
        .orElseThrow();
  }
}
