package edu.cnm.deepdive.farkle.model.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonInclude.Include;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonProperty.Access;
import com.fasterxml.jackson.annotation.JsonPropertyOrder;
import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.Temporal;
import jakarta.persistence.TemporalType;
import jakarta.persistence.UniqueConstraint;
import java.time.Instant;
import org.hibernate.annotations.CreationTimestamp;

@SuppressWarnings("JpaDataSourceORMInspection")
@Entity
@Table(
    uniqueConstraints = @UniqueConstraint(columnNames = {"game_id", "user_profile_id"})
)
@JsonPropertyOrder({"joinedAt", "score", "user", "lastTurn"})
@JsonInclude(Include.NON_NULL)
public class GamePlayer {

  @Id
  @GeneratedValue
  @Column(name = "game_player_id", nullable = false, updatable = false)
  @JsonIgnore
  private long id;

  @CreationTimestamp
  @Temporal(TemporalType.TIMESTAMP)
  @Column(nullable = false, updatable = false)
  @JsonProperty(access = Access.READ_ONLY)
  private Instant joinedAt;

  @ManyToOne(fetch = FetchType.LAZY, optional = false, cascade = {CascadeType.DETACH, CascadeType.MERGE, CascadeType.REFRESH})
  @JoinColumn(name = "game_id", nullable = false, updatable = false)
  @JsonIgnore
  private Game game;

  @ManyToOne(fetch = FetchType.EAGER, optional = false, cascade = {CascadeType.DETACH, CascadeType.MERGE, CascadeType.REFRESH})
  @JoinColumn(name = "user_profile_id", nullable = false, updatable = false)
  @JsonProperty(access = Access.READ_ONLY)
  private User user;

  // TODO: 4/4/25 Add transient fields for lastRoll and Current score only completed turns
  
  public long getId() {
    return id;
  }

  public Instant getJoinedAt() {
    return joinedAt;
  }

  public Game getGame() {
    return game;
  }

  public void setGame(Game game) {
    this.game = game;
  }

  public User getUser() {
    return user;
  }

  public void setUser(User user) {
    this.user = user;
  }

  @JsonSerialize(as = AnonymousTurn.class)
  public Turn getLastTurn(){
    return game
        .getTurns()
        .stream()
        .filter((turn) -> turn.getUser().equals(user))
        .reduce((turn1, turn2) -> turn2)
        .orElse(null);
  }

  public int getScore() {
    return game
        .getTurns()
        .stream()
        .filter((turn) -> turn.getUser().equals(user))
        .filter(Turn::isFinished)
        .mapToInt(Turn::getScore)
        .sum();
  }

}
