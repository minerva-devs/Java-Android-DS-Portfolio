package edu.cnm.deepdive.farkle.model.dto;

import com.google.gson.annotations.Expose;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public class Game {

  @Expose(serialize = false)
  private UUID key;

  @Expose(serialize = false)
  private Instant createdAt;

  @Expose(serialize = false)
  private Instant startedAt;

  @Expose(serialize = false)
  private State state;

  @Expose(serialize = false)
  private int rollCount;

  @Expose(serialize = false)
  private User winner;

  @Expose(serialize = false)
  private List<GamePlayer> players;

  @Expose(serialize = false)
  private Turn currentTurn;

  public UUID getKey() {
    return key;
  }

  public void setKey(UUID key) {
    this.key = key;
  }

  public Instant getCreatedAt() {
    return createdAt;
  }

  public void setCreatedAt(Instant createdAt) {
    this.createdAt = createdAt;
  }

  public Instant getStartedAt() {
    return startedAt;
  }

  public void setStartedAt(Instant startedAt) {
    this.startedAt = startedAt;
  }

  public State getState() {
    return state;
  }

  public void setState(State state) {
    this.state = state;
  }

  public int getRollCount() {
    return rollCount;
  }

  public void setRollCount(int rollCount) {
    this.rollCount = rollCount;
  }

  public User getWinner() {
    return winner;
  }

  public void setWinner(User winner) {
    this.winner = winner;
  }

  public List<GamePlayer> getPlayers() {
    return players;
  }

  public void setPlayers(List<GamePlayer> players) {
    this.players = players;
  }

  public Turn getCurrentTurn() {
    return currentTurn;
  }

  public void setCurrentTurn(Turn currentTurn) {
    this.currentTurn = currentTurn;
  }

}
