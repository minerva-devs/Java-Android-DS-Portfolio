package edu.cnm.deepdive.farkle.model.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonInclude.Include;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonProperty.Access;
import com.fasterxml.jackson.annotation.JsonPropertyOrder;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Temporal;
import jakarta.persistence.TemporalType;
import java.time.Instant;
import java.util.LinkedList;
import java.util.List;
import java.util.UUID;
import org.hibernate.annotations.CreationTimestamp;

@SuppressWarnings("JpaDataSourceORMInspection")
@Entity
@JsonPropertyOrder({"key", "startedAt", "finished", "farkle", "score", "user", "lastRoll"})
@JsonInclude(Include.NON_NULL)
public class Turn implements AnonymousTurn {

  @Id
  @GeneratedValue
  @Column(name = "turn_id")
  @JsonIgnore
  private long id;

  @Column(unique = true, nullable = false, updatable = false)
  @JsonProperty(value = "key", access = Access.READ_ONLY)
  private UUID externalKey;

  @Column(nullable = false)
  @JsonProperty(access = Access.READ_ONLY)
  @CreationTimestamp
  @Temporal(TemporalType.TIMESTAMP)
  private Instant startedAt;

  @JoinColumn(name = "user_id", nullable = false, updatable = false)
  @ManyToOne(fetch = FetchType.EAGER, optional = false)
  private User user;
  // TODO: 4/4/25 Exclude this field when looking at last turn for each user

  @Column(nullable = false)
  @JsonProperty(access = Access.READ_ONLY)
  private boolean finished;

  @OneToMany(mappedBy = "turn", fetch = FetchType.EAGER, cascade = CascadeType.ALL, orphanRemoval = true)
  @OrderBy("rolledAt ASC")
  @JsonIgnore
  private final List<Roll> rolls = new LinkedList<>();

  @ManyToOne(optional = false, fetch = FetchType.LAZY)
  @JoinColumn(name = "game_id", nullable = false, updatable = false)
  @JsonIgnore
  private Game game;

  private long getId() {
    return id;
  }

  public UUID getExternalKey() {
    return externalKey;
  }

  @Override
  public boolean isFarkle() {
    return rolls.stream().anyMatch(Roll::isFarkle);
  }

  @Override
  public boolean isFinished() {
    return finished;
  }

  public void setFinished(boolean finished) {
    this.finished = finished;
  }

  public List<Roll> getRolls() {
    return rolls;
  }

  public User getUser() {
    return user;
  }

  public void setUser(User user) {
    this.user = user;
  }

  @Override
  public Instant getStartedAt() {
    return startedAt;
  }

  public Game getGame() {
    return game;
  }

  public void setGame(Game game) {
    this.game = game;
  }

  @Override
  public Roll getLastRoll() {
    return rolls.isEmpty() ? null : rolls.getLast();
  }

  @Override
  public int getScore() {
    return isFarkle()
        ? 0
        : rolls
            .stream()
            .mapToInt(Roll::getRollScore)
            .sum();
  }


  @PrePersist
  void generateFieldValues() {
    externalKey = UUID.randomUUID();
  }

}
