package edu.cnm.deepdive.farkle.controller;

import edu.cnm.deepdive.farkle.model.entity.User;
import edu.cnm.deepdive.farkle.service.AbstractUserService;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/users")
public class UserController {

  private final AbstractUserService userService;

  @Autowired
  public UserController(AbstractUserService userService) {
    this.userService = userService;
  }

  @GetMapping(path = "/me", produces = MediaType.APPLICATION_JSON_VALUE)

  public User get() {
    return userService.getCurrent();
  }

  @PutMapping(path = "/me",
      consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
  public User put(@RequestBody User user) {
    return userService.update(user);
  }

  @GetMapping(path = "/{externalKey}", produces = MediaType.APPLICATION_JSON_VALUE)
  public User get(@PathVariable UUID externalKey) {
    return userService.get(externalKey);
  }
}
