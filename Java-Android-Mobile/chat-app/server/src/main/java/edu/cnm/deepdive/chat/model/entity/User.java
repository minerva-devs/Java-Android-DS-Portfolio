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
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import jakarta.persistence.Temporal;
import jakarta.persistence.TemporalType;
import java.net.URL;
import java.time.Instant;
import java.util.LinkedList;
import java.util.List;
import java.util.UUID;
import org.hibernate.annotations.CreationTimestamp;

@SuppressWarnings("JpaDataSourceORMInspection")
@Entity
@Table(
    name = "user_profile",
    indexes = {
        @Index(columnList = "joined")
    }
)
//Any of the fields that are nulls won't bother serialization
//Json looks at our getters
@JsonInclude(Include.NON_NULL)
public class User {

  @Id
  @GeneratedValue
  @Column(name = "user_profile_id", nullable = false, updatable = false)
  @JsonIgnore
  private long id;

  @Column(nullable = false, updatable = false, unique = true)
  @JsonProperty(value = "key", access = Access.READ_ONLY)
  private UUID externalKey;

  @CreationTimestamp
  @Temporal(TemporalType.TIMESTAMP)
  @Column(nullable = false, updatable = false)
  @JsonProperty(access = Access.READ_ONLY)
  private Instant joined;

  @Column(nullable = false, updatable = true, length = 30, unique = true)
  private String displayName;

  @Column(nullable = true, updatable = true)
  private URL avatar;

  @Column(nullable = false, updatable = false, length = 30, unique = true)
  @JsonIgnore
  private String oauthKey;

  @OneToMany(mappedBy = "sender", fetch = FetchType.LAZY,
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

  public Instant getJoined() {
    return joined;
  }

  public String getDisplayName() { return displayName;}

  public void setDisplayName(String displayName) {
    this.displayName = displayName;
  }

  public URL getAvatar() {
    return avatar;
  }

  public void setAvatar(URL avatar) {
    this.avatar = avatar;
  }

  public String getOauthKey() {
    return oauthKey;
  }

  public void setOauthKey(String oauthKey) {
    this.oauthKey = oauthKey;
  }

  public List<Message> getMessages() {return messages;}

  @Override
  public int hashCode() {
    return Long.hashCode(id);
  }

  @Override
  public boolean equals(Object obj) {
    boolean result;
    if (obj == this) {
      result = true;
    } else if (obj instanceof User other) {
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
