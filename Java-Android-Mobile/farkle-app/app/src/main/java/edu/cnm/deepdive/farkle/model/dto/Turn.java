package edu.cnm.deepdive.farkle.model.dto;

import com.google.gson.annotations.Expose;
import java.time.Instant;
import java.util.UUID;

public class Turn {

  @Expose(serialize = false)
  private UUID key;

  @Expose(serialize = false)
  private Instant startedAt;

  @Expose(serialize = false)
  private boolean finished;

  @Expose(serialize = false)
  private boolean farkle;

  @Expose(serialize = false)
  private User user;

  @Expose(serialize = false)
  private int score;

  @Expose(serialize = false)
  private Roll lastRoll;

  public UUID getKey() {
    return key;
  }

  public void setKey(UUID key) {
    this.key = key;
  }

  public Instant getStartedAt() {
    return startedAt;
  }

  public void setStartedAt(Instant startedAt) {
    this.startedAt = startedAt;
  }

  public boolean isFinished() {
    return finished;
  }

  public void setFinished(boolean finished) {
    this.finished = finished;
  }

  public boolean isFarkle() {
    return farkle;
  }

  public void setFarkle(boolean farkle) {
    this.farkle = farkle;
  }

  public User getUser() {
    return user;
  }

  public void setUser(User user) {
    this.user = user;
  }

  public int getScore() {
    return score;
  }

  public void setScore(int score) {
    this.score = score;
  }

  public Roll getLastRoll() {
    return lastRoll;
  }

  public void setLastRoll(Roll lastRoll) {
    this.lastRoll = lastRoll;
  }

}