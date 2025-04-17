package edu.cnm.deepdive.chat.model.dto;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import com.google.gson.annotations.Expose;
import java.util.UUID;
import org.jetbrains.annotations.NotNull;

public class Channel {

  //getting these from the output in our scratch.

  @Expose(serialize = false)
  private UUID key;

  @Expose(serialize = false)
  private String name;

  @Expose(serialize = false)
  private boolean active;

  public UUID getKey() {
    return key;
  }

  public void setKey(UUID key) {
    this.key = key;
  }

  public String getName() {
    return name;
  }

  public void setName(String name) {
    this.name = name;
  }

  public boolean isActive() {
    return active;
  }

  public void setActive(boolean active) {
    this.active = active;
  }

  //when we implement equals, we must implement hashcode
  //will use UUID as hashcode to compare if channels are equal
  //for MessageViewModel*****
  //so whatever UUID is (key), let it give the hashcode
  @Override
  public int hashCode() {
    return key.hashCode();
  }

  //if obj is pointing to same place in memory/reference= true, then they're equal
  //if diff obj, but still a channel, then true-- pattern instanceof-- it's casting
  //EQUALS method, the else if method used to find what makes anything unique
  //may or may not be key, may or may not be right
  @Override
  public boolean equals(@Nullable Object obj) {
    boolean result;
    if (this == obj) {
      result = true;
    } else if (obj instanceof Channel other) {
      result = key.equals(other.key);
    } else {
      result = false;
    }
    return super.equals(obj);
  }

  @NonNull
  @Override
  public @NotNull String toString() {
    return name;
  }
}
