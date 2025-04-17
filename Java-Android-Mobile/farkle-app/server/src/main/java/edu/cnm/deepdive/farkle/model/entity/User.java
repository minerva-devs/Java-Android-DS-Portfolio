package edu.cnm.deepdive.farkle.model.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonPropertyOrder;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.util.LinkedList;
import java.util.List;
import java.util.UUID;

@SuppressWarnings("JpaDataSourceORMInspection")
@Entity
@Table(name = "user_profile")
@JsonPropertyOrder({"key", "displayName"})
public class User {

  @Id
  @GeneratedValue
  @Column(name = "user_profile_id", nullable = false)
  @JsonIgnore
  private long id;

  @Column(nullable = false, updatable = false, unique = true)
  @JsonProperty(value = "key", access = JsonProperty.Access.READ_ONLY)
  private UUID externalKey;

  @Column(nullable = true)
  @JsonIgnore
  private String authKey;

  @Column(nullable = true)
  private String displayName;

  @OneToMany(mappedBy = "user", fetch = FetchType.LAZY, cascade = CascadeType.ALL, orphanRemoval = true)
  @OrderBy("joinedAt ASC")
  @JsonIgnore
  private final List<GamePlayer> games = new LinkedList<>();

  public long getId() {
    return id;
  }

  public UUID getExternalKey() {
    return externalKey;
  }

  public String getAuthKey() {
    return authKey;
  }

  public void setAuthKey(String authKey) {
    this.authKey = authKey;
  }

  public String getDisplayName() {
    return displayName;
  }

  public void setDisplayName(String gameName) {

    this.displayName = gameName;
  }

  public List<GamePlayer> getGames() {
    return games;
  }

  @PrePersist
  void generateFieldValues() {
    externalKey = UUID.randomUUID();
  }

  @Override
  public int hashCode() {
    return Long.hashCode(id);
  }

  @Override
  public boolean equals(Object obj) {
    boolean result;
    if (this == obj) {
      result = true;
    } else if (obj instanceof User other) {
      result = other.id == this.id;
    } else {
      result = false;
    }
    return result;
  }
}