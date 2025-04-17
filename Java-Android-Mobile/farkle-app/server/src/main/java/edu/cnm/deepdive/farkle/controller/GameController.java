package edu.cnm.deepdive.farkle.controller;


import edu.cnm.deepdive.farkle.model.dto.RollAction;
import edu.cnm.deepdive.farkle.model.entity.Game;
import edu.cnm.deepdive.farkle.model.entity.Roll;
import edu.cnm.deepdive.farkle.model.entity.State;
import edu.cnm.deepdive.farkle.service.AbstractGameService;
import edu.cnm.deepdive.farkle.service.AbstractUserService;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.context.request.async.DeferredResult;

@RestController
@RequestMapping("/games")
public class GameController {

  private final AbstractGameService gameService;
  private final AbstractUserService userService; // TODO: 3/20/25 Add this to other controllers

  @Autowired
  public GameController(AbstractGameService gameService, AbstractUserService userService) {
    this.gameService = gameService;
    this.userService = userService;
  }

  @PostMapping(produces = MediaType.APPLICATION_JSON_VALUE)
  public Game post(){
    return gameService.startOrJoin(userService.getCurrent());
  }

  @PostMapping(path = "/{key}/actions", consumes = MediaType.APPLICATION_JSON_VALUE)
  public boolean freezeOrContinue(@RequestBody RollAction action, @PathVariable UUID key) {
    return gameService.freezeOrContinue(action, key, userService.getCurrent());
  }

  @GetMapping(path = "/{key}", produces = MediaType.APPLICATION_JSON_VALUE)
  public Game get(@PathVariable UUID key) {
    return gameService.getGame(key, userService.getCurrent());
  }

  @GetMapping(path = "/{key}", produces = MediaType.APPLICATION_JSON_VALUE, params = {"state", "rollCount"})
  public DeferredResult<Game> get(@PathVariable UUID key, @RequestParam State state, @RequestParam int rollCount) throws Throwable {
    return gameService.getGame(key, userService.getCurrent(), state, rollCount);
  }
}
