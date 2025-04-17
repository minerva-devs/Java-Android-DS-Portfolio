package edu.cnm.deepdive.chat.model.dao;

import edu.cnm.deepdive.chat.model.entity.Channel;
import edu.cnm.deepdive.chat.model.entity.Message;
import java.time.Instant;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface MessageRepository extends JpaRepository<Message, Long> {

  public static final String LATEST_POSTED_QUERY = """
      SELECT 
      m.posted 
      FROM 
        Message AS m 
      WHERE 
        m.channel = :channel 
        AND m.posted > :posted 
      ORDER BY 
        m.posted ASC
      """;

  //this is key query to refresh display, recurrently q20 sec
  List<Message> getAllByChannelAndPostedAfterOrderByPostedAsc(Channel channel, Instant posted);

  @Query(LATEST_POSTED_QUERY)
  List<Instant> getLastPostedByChannelAndPostedAfter(
      Channel channel, Instant posted, Pageable pageable);


  /*
  SELECT
  n FROM message AS n
  WHERE
    n.channel = channel
    AND n.posted > :posted
    ORDER BY
    n.posted ABC

 */

}

//we never need to retrieve a message by its external key
//when the controller receives a request to fetch messages since a date instance, if there aren't, it will wait 20 sec until there are some