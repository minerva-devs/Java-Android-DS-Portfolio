package edu.cnm.deepdive.farkle.model.entity;

import java.time.Instant;

public interface AnonymousTurn {

  boolean isFarkle();

  boolean isFinished();

  Instant getStartedAt();

  Roll getLastRoll();

  int getScore();
}
