package edu.cnm.deepdive.farkle.service;

import edu.cnm.deepdive.farkle.model.dto.RollAction;
import edu.cnm.deepdive.farkle.model.entity.Game;
import edu.cnm.deepdive.farkle.model.entity.Roll;
import edu.cnm.deepdive.farkle.model.entity.State;
import edu.cnm.deepdive.farkle.model.entity.User;
import java.util.UUID;
import org.springframework.web.context.request.async.DeferredResult;

public interface AbstractGameService {

  Game startOrJoin(User user);

  Game getGame(UUID gameKey, User user);

  DeferredResult<Game> getGame(UUID gameKey, User user, State state, int rollCount)
      throws Throwable;

  boolean freezeOrContinue(RollAction action, UUID key, User user);

}
