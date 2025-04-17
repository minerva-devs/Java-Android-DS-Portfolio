package edu.cnm.deepdive.chat.model.dao;

import edu.cnm.deepdive.chat.model.entity.Channel;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ChannelRepository extends JpaRepository<Channel, Long> {

  List<Channel> getAllByOrderByNameAsc();
 //get a list of all active channel by passing a true or false
  List<Channel> getAllByActiveOrderByNameAsc(boolean active);

  //way to not expose our primary keys outside our database
  Optional<Channel> findByExternalKey(UUID externalKey);



}
