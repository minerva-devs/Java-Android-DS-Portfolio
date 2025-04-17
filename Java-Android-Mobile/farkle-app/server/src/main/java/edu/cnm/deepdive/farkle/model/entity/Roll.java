package edu.cnm.deepdive.farkle.model.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonProperty.Access;
import com.fasterxml.jackson.annotation.JsonPropertyOrder;
import jakarta.persistence.AttributeOverride;
import jakarta.persistence.AttributeOverrides;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Embeddable;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Temporal;
import jakarta.persistence.TemporalType;
import java.time.Instant;
import java.util.LinkedList;
import java.util.List;
import org.hibernate.annotations.CreationTimestamp;

@Entity
@JsonPropertyOrder({"rolledAt", "farkle", "score", "numberDice", "dice"})
public class Roll {

  @Id
  @GeneratedValue
  @Column(name = "roll_id")
  @JsonIgnore
  private long id;

  @Column(nullable = true)
  @JsonProperty(value = "score", access = Access.READ_ONLY)
  private int rollScore;

  @Column(nullable = false, updatable = true)
  @JsonProperty(access = Access.READ_ONLY)
  private boolean farkle;

  @Column(nullable = false, updatable = false)
  @JsonProperty(access = Access.READ_ONLY)
  private int numberDice;

  @JoinColumn(name = "turn_id", nullable = false, updatable = false)
  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JsonIgnore
  private Turn turn;

  @Column(nullable = false)
  @CreationTimestamp
  @Temporal(TemporalType.TIMESTAMP)
  @JsonProperty(access = Access.READ_ONLY)
  private Instant rolledAt;

  @ElementCollection(fetch = FetchType.EAGER)
  @CollectionTable(name = "roll_die", joinColumns = @JoinColumn(name = "roll_id"))
  @AttributeOverrides(
      {
          @AttributeOverride(name = "value", column = @Column(name = "face_value", nullable = false, updatable = false)),
          @AttributeOverride(name = "group", column = @Column(name = "scoring_group", nullable = false, updatable = false))
      }
  )
  @JsonProperty(access = Access.READ_ONLY)
  private final List<Die> dice = new LinkedList<>();

  public long getId() {
    return id;
  }

  public int getRollScore() {
    return rollScore;
  }

  public void setRollScore(int rollScore) {
    this.rollScore = rollScore;
  }

  public boolean isFarkle() {
    return farkle;
  }

  public void setFarkle(boolean farkle) {
    this.farkle = farkle;
  }

  public int getNumberDice() {
    return numberDice;
  }

  public void setNumberDice(int numberDice) {
    this.numberDice = numberDice;
  }

  public List<Die> getDice() {
    return dice;
  }

  public Turn getTurn() {
    return turn;
  }

  public void setTurn(Turn turn) {
    this.turn = turn;
  }

  public Instant getRolledAt() {
    return rolledAt;
  }

  @Embeddable
  public static class Die {

    private int value;

    private int group;

    public int getValue() {
      return value;
    }

    public void setValue(int value) {
      this.value = value;
    }

    public int getGroup() {
      return group;
    }

    public void setGroup(int group) {
      this.group = group;
    }

    @Override
    public boolean equals(Object obj) {
      boolean result;
      if (this == obj) {
        result = true;
      } else if (obj instanceof Die other) {
        result = other.value == this.value;
      } else {
        result = false;
      }
      return super.equals(obj);
    }

    @Override
    public int hashCode() {
      return Integer.hashCode(value);
    }
  }

}