package edu.cnm.deepdive.notes.model.pojo;

import androidx.room.Relation;
import edu.cnm.deepdive.notes.model.entity.Note;
import edu.cnm.deepdive.notes.model.entity.User;

public class NoteWithUser extends Note {

  @Relation(parentColumn = "user_id", entityColumn = "user_id")
  private User user;


  public User getUser() {
    return user;
  }

  public void setUser(User user) {
    this.user = user;
  }
}
