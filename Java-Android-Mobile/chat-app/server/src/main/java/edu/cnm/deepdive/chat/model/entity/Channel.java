package edu.cnm.deepdive.chat.model.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonInclude.Include;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonProperty.Access;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.util.LinkedList;
import java.util.List;
import java.util.UUID;

@SuppressWarnings("JpaDataSourceORMInspection")
@Entity
@Table(
    indexes = {
        @Index(columnList = "active,name")
    }
)
@JsonInclude(Include.NON_NULL)
public class Channel {

  @Id
  @GeneratedValue
  @Column(name = "channel_id", nullable = false, updatable = false)
  @JsonIgnore
  private long id;

  @Column(nullable = false, updatable = false, unique = true)
  @JsonProperty(value = "key", access = Access.READ_ONLY)
  private UUID externalKey;

  @Column(nullable = false, updatable = false, unique = true, length = 50)
  private String name;

  @Column(nullable = false, updatable = true)
  private boolean active;

  @OneToMany(mappedBy = "channel", fetch = FetchType.LAZY,
      cascade = CascadeType.ALL, orphanRemoval = true)
  @OrderBy("posted ASC")
  @JsonIgnore
  private final List<Message> messages = new LinkedList<>();

  public long getId() {
    return id;
  }

  public UUID getExternalKey() {
    return externalKey;
  }

  public String getName() {
    return name;
  }

  public void setName(String name) {
    this.name = name;
  }

  public List<Message> getMessages() {
    return messages;
  }

  public boolean isActive() {
    return active;
  }

  public void setActive(boolean active) {
    this.active = active;
  }

  @Override
  public int hashCode() {
    return Long.hashCode(id);
  }

  @Override
  public boolean equals(Object obj) {
    boolean result;
    if (obj == this) {
      result = true;
    } else if (obj instanceof Channel other) {
      result = (id != 0 && id == other.id);
    } else {
      result = false;
    }
    return result;
  }

  @PrePersist
  void generateFieldValues() {
    externalKey = UUID.randomUUID();
  }

}
