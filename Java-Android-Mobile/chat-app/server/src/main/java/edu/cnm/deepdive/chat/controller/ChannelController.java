package edu.cnm.deepdive.chat.controller;

import edu.cnm.deepdive.chat.model.entity.Channel;
import edu.cnm.deepdive.chat.service.AbstractChannelService;
import java.util.List;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/channels")
public class ChannelController {

  //  to do its job controller needs channel service
   private final AbstractChannelService channelService;

  @Autowired
   public ChannelController(AbstractChannelService channelService) {
    this.channelService = channelService;
  }

  @PostMapping(
      consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
  public Channel post(@RequestBody Channel channel) {// FIXME: 3/6/25 Use ResponseEntity}
    return channelService.add(channel);
  }

  //delegate the implementation to a channel service
  @GetMapping(path= "/{externalKey}", produces = MediaType.APPLICATION_JSON_VALUE)
  public Channel get(@PathVariable UUID externalKey) {
    return channelService.get(externalKey);
  }

  //Two pairs of Rest modifiers: putName, getName & putActive, getActive

  //even tho this is a scaler value, we want it back as JSON string, place in ""
  @PutMapping(path = "/{externalKey}/name",
      consumes =  MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
  public String putName(@PathVariable UUID externalKey, @RequestBody String name) {
    return channelService.setName(externalKey, name);
  }

  //there's a body in the response but not in the request
  @GetMapping(path = "/{externalKey}/name", produces = MediaType.APPLICATION_JSON_VALUE)
  public String getName(@PathVariable UUID externalKey) {
    return channelService.getName(externalKey);
  }

  @PutMapping(path = "/{externalKey}/active",
      consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
  public boolean putActive(@PathVariable UUID externalKey, @RequestBody boolean active) {
    return channelService.setActive(externalKey, active);
  }

  @GetMapping(path = "/{externalKey}/active", produces = MediaType.APPLICATION_JSON_VALUE)
  public boolean getActive(@PathVariable UUID externalKey) {
    return channelService.getActive(externalKey);
  }

  @DeleteMapping(path = "/{externalKey}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void delete(@PathVariable UUID externalKey) {
    channelService.remove(externalKey);
  }

  // 2 Queries: 2 Gets

  @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE, params = {"active"})
  public List<Channel> getByActive(@RequestParam boolean active) {
    return channelService.getAllByActive(active);
  }

  @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
  public List<Channel> getAll() {
    return channelService.getAll();
  }




}
