package edu.cnm.deepdive.chat.controller;

import edu.cnm.deepdive.chat.model.entity.Message;
import edu.cnm.deepdive.chat.service.AbstractMessageService;
import edu.cnm.deepdive.chat.service.AbstractUserService;
import jakarta.validation.Valid;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.context.request.async.DeferredResult;

@RestController
@RequestMapping("/channels/{channelKey:[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}}/messages")
@Validated
public class MessageController {

  public static final String DEFAULT_SINCE_VALUE = "-1000000000-01-01T00:00:00Z";
  private final AbstractMessageService messageService;
  private final AbstractUserService userService;

  @Autowired
  public MessageController(AbstractMessageService messageService, AbstractUserService userService) {
    this.messageService = messageService;
    this.userService = userService;
  }

  @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
  public List<Message> post(
      @RequestBody @Valid Message message,
      @PathVariable UUID channelKey,
      @RequestParam(required = false, defaultValue = DEFAULT_SINCE_VALUE) Instant since
  ) {
    return messageService
        .add(message, channelKey, userService.getCurrent(), since);
  }

  @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
  public DeferredResult<List<Message>> get(
      @PathVariable UUID channelKey,
      @RequestParam(required = false, defaultValue = DEFAULT_SINCE_VALUE) Instant since
  ) {
    return messageService.pollSince(channelKey, since);
  }

}
