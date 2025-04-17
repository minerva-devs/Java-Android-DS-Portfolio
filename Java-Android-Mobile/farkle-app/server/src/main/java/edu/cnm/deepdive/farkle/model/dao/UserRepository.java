package edu.cnm.deepdive.farkle.model.dao;

import edu.cnm.deepdive.farkle.model.entity.User;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRepository extends JpaRepository<User,Long> {

  Optional<User> findByAuthKey(String authKey);

  Optional<User> findByExternalKey(UUID externalKey);


}
