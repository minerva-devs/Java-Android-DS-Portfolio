package edu.cnm.deepdive.chat.service;

import edu.cnm.deepdive.chat.model.dao.UserRepository;
import edu.cnm.deepdive.chat.model.entity.User;
import java.net.URL;
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
  public User getOrCreate(String oauthKey, String displayName) {
    return userRepository
        .findByOauthKey(oauthKey)
        .orElseGet(() ->{
          User user = new User();
          user.setOauthKey(oauthKey);
          user.setDisplayName(displayName);
          // TODO: 3/5/25 Set avatar.
          return userRepository.save(user);
        });
  }

  @Override
  public User update(User user) {
    return userRepository
        //getCurrent is the bearer token- it's what the user did- to change display name
        //fetched existing record using that id
        .findById(getCurrent().getId())
        .map((u) -> {
          String displayName = user.getDisplayName();
          if (displayName != null) {
            u.setDisplayName(displayName);
          }
          URL avatar = user.getAvatar();
          if (avatar != null) {
            u.setAvatar(avatar);
          }
          return userRepository.save(u);
        })
        .orElseThrow();
  }

}
