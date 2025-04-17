package edu.cnm.deepdive.farkle.model.dto;

import androidx.annotation.Nullable;
import com.google.gson.annotations.Expose;
import java.util.UUID;

public class User {

  @Expose(serialize = false)
  private UUID key;

  @Expose(serialize = false)
  private String displayName;


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

  @Override
  public int hashCode() {
    return key.hashCode();
  }

  @Override
  public boolean equals(@Nullable Object obj) {
    boolean result;
    if (obj == this) {
      result = true;
    } else if (obj instanceof User other) {
      result = key.equals(other.key);
    } else {
      result = false;
    }
    return result;
  }
}
