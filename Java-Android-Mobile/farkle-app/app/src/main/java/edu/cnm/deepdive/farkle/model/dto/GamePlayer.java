package edu.cnm.deepdive.farkle.model.dto;

import com.google.gson.annotations.Expose;
import java.time.Instant;

public class GamePlayer {

  @Expose(serialize = false)
  private Instant joinedAt;

  @Expose(serialize = false)
  private int score;

  @Expose(serialize = false)
  private User user;


  @Expose(serialize = false)
  private Turn lastTurn;

  public Instant getJoinedAt() {
    return joinedAt;
  }

  public void setJoinedAt(Instant joinedAt) {
    this.joinedAt = joinedAt;
  }

  public int getScore() {
    return score;
  }

  public void setScore(int score) {
    this.score = score;
  }

  public User getUser() {
    return user;
  }

  public void setUser(User user) {
    this.user = user;
  }

  public Turn getLastTurn() {
    return lastTurn;
  }

  public void setLastTurn(Turn lastTurn) {
    this.lastTurn = lastTurn;
  }

}