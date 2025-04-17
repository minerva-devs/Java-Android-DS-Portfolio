package edu.cnm.deepdive.notes.model.pojo;

import androidx.room.Relation;
import edu.cnm.deepdive.notes.model.entity.Note;
import edu.cnm.deepdive.notes.model.entity.User;
import java.util.List;

public class UserWithNotes extends User {

  @Relation(parentColumn = "user_id", entityColumn = "user_id")
  private List<Note> notes;

  public List<Note> getNotes() {
    return notes;
  }

  public void setNotes(List<Note> notes) {
    this.notes = notes;
  }
}
