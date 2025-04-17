package edu.cnm.deepdive.chat.model.dto;

import com.google.gson.annotations.Expose;
import java.time.Instant;
import java.util.UUID;

public class Message {
   //from http output fields GSON

  @Expose(serialize = false)
  private UUID key;

  @Expose(serialize = false)
  private Instant posted;

  @Expose
  private String text;

  @Expose(serialize = false)
  private User sender;


  public UUID getKey() {
    return key;
  }

  public void setKey(UUID key) {
    this.key = key;
  }

  public Instant getPosted() {
    return posted;
  }

  public void setPosted(Instant posted) {
    this.posted = posted;
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
}
