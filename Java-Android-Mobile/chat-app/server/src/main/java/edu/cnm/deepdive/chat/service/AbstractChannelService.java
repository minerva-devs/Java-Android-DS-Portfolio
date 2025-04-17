package edu.cnm.deepdive.chat.service;

import edu.cnm.deepdive.chat.model.entity.Channel;
import java.util.List;
import java.util.UUID;

public interface AbstractChannelService {

  //retrieve a channel
  Channel get(UUID externalKey);

  //to modify channel or creating a channel in the first place
  Channel add(Channel channel);

  //Setter and Getter for name: get the name & return the same name to confirm it's correct
  String setName(UUID externalKey, String name);

  String getName (UUID externalKey);

  boolean setActive(UUID externalKey, boolean active);

  boolean getActive(UUID externalKey);

  void remove(UUID externalKey);

  List<Channel> getAll();

  List<Channel> getAllByActive(boolean active);





}
