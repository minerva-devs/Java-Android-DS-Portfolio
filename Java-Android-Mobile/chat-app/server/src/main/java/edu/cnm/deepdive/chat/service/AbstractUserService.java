package edu.cnm.deepdive.chat.service;

import edu.cnm.deepdive.chat.model.entity.User;
import java.util.UUID;

public interface AbstractUserService {
  //will define high level business operations for the user,

  // CRUD not involved
    User getCurrent();

  //will use CRUD
  User get(UUID externalKey);


  User getOrCreate(String oauthKey, String displayName);

  User update(User user);


}
