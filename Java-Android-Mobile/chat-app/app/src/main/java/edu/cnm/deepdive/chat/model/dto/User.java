package edu.cnm.deepdive.chat.model.dto;

import com.google.gson.annotations.Expose;
import java.net.URL;
import java.time.Instant;
import java.util.UUID;

public class User {
//serialize is for outgoing, for putting on the wire

  @Expose(serialize = false, deserialize = true)
  private UUID key;

  @Expose
  private String displayName;

  @Expose
  private URL avatar;

  @Expose(serialize = false, deserialize = true)
  private Instant joined;

  public UUID getKey() {
    return key;
  }

  public void setKey(UUID key) {
    this.key = key;
  }

  public String getDisplayName() {
    return displayName;
  }

  public void setDisplayName(String displayName) {
    this.displayName = displayName;
  }

  public URL getAvatar() {
    return avatar;
  }

  public void setAvatar(URL avatar) {
    this.avatar = avatar;
  }

  public Instant getJoined() {
    return joined;
  }

  public void setJoined(Instant joined) {
    this.joined = joined;
  }
}
