package edu.cnm.deepdive.farkle.service;

import edu.cnm.deepdive.farkle.model.entity.User;
import java.util.UUID;

public interface AbstractUserService {

  User getCurrent();

  User get(UUID externalKey);

  User getOrCreate(String oauthKey, String displayName);

  User update(User user);

}
