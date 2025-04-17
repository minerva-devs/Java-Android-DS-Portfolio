package edu.cnm.deepdive.chat.model.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonInclude.Include;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonProperty.Access;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import jakarta.persistence.Temporal;
import jakarta.persistence.TemporalType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.validator.constraints.Length;

@Entity
//this should help make this polling query fast
@Table(indexes = {
    @Index(columnList = "channel_id, posted")
})
@JsonInclude(Include.NON_NULL)
public class Message {

  @Id
  @GeneratedValue
  @Column(name = "message_id", nullable = false, updatable = false) //message_id is column
  @JsonIgnore  //don't read or write to JSON
  private long id;  //field

  @Column(nullable = false, updatable = false, unique = true)
  @JsonProperty(value = "key", access = Access.READ_ONLY )
  private UUID externalKey;

  @CreationTimestamp
  @Temporal(TemporalType.TIMESTAMP)
  @Column(nullable = false, updatable = false)
  @JsonProperty(access = Access.READ_ONLY)
  private Instant posted;

  @Column(nullable = false, updatable = false, length = 255)
  @NotNull
  @Length(min = 1, max = 255)
  private String text;

  @ManyToOne(fetch = FetchType.EAGER, optional = false)
  @JoinColumn(name = "sender_id", nullable = false, updatable = false)
  @JsonProperty(access = Access.READ_ONLY)
  private User sender;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "channel_id", nullable = false, updatable = false)
  @JsonIgnore
  private Channel channel;

  public long getId() {
    return id;
  }

  public UUID getExternalKey() {
    return externalKey;
  }

  public Instant getPosted() {
    return posted;
  }

  public String getText() {
    return text;
  }

  public void setText(String text) {
    this.text = text;
  }

  public User getSender() {
    return sender;
  }

  public void setSender(User sender) {
    this.sender = sender;
  }

  public Channel getChannel() {
    return channel;
  }

  public void setChannel(Channel channel) {
    this.channel = channel;
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
    } else if (obj instanceof Message other) {
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
