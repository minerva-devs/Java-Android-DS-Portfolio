package edu.cnm.deepdive.notes.model.entity;

import androidx.annotation.NonNull;
import androidx.room.ColumnInfo;
import androidx.room.Entity;
import androidx.room.Index;
import androidx.room.PrimaryKey;
import java.time.Instant;

@Entity(
    tableName = "user",
    indices = {
        @Index(value = "oauth_key", unique = true)
    }
)
public class User {

  @PrimaryKey(autoGenerate = true)
  @ColumnInfo(name = "user_id")
  private long id;

  @NonNull
  @ColumnInfo(name = "display_name", collate = ColumnInfo.NOCASE)
  private String displayName = "";

  @NonNull
  @ColumnInfo(name = "oauth_key", collate = ColumnInfo.NOCASE)
  private String oauthKey = "";

  @NonNull
  private Instant created = Instant.now();

  public long getId() {
    return id;
  }

  public void setId(long id) {
    this.id = id;
  }

  @NonNull
  public String getDisplayName() {
    return displayName;
  }

  public void setDisplayName(@NonNull String displayName) {
    this.displayName = displayName;
  }

  @NonNull
  public String getOauthKey() {
    return oauthKey;
  }

  public void setOauthKey(@NonNull String oauthKey) {
    this.oauthKey = oauthKey;
  }

  @NonNull
  public Instant getCreated() {
    return created;
  }

  public void setCreated(@NonNull Instant created) {
    this.created = created;
  }


}
