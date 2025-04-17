package edu.cnm.deepdive.chat.model.dao;

import edu.cnm.deepdive.chat.model.entity.User;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface UserRepository extends JpaRepository<User,Long> {

  Optional<User> findByOauthKey(String oauthKey);

  Optional<User> findByExternalKey(UUID externalKey);


}
