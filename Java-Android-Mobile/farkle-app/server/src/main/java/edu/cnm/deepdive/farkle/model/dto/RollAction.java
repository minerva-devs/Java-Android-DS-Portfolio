package edu.cnm.deepdive.farkle.model.dto;

import com.fasterxml.jackson.annotation.JsonPropertyOrder;

@JsonPropertyOrder({"frozenGroups", "finished"})
public class RollAction {

  private int[][] frozenGroups;
  private boolean finished;

  public int[][] getFrozenGroups() {
    return frozenGroups;
  }

  public void setFrozenGroups(int[][] frozenGroups) {
    this.frozenGroups = frozenGroups;
  }

  public boolean isFinished() {
    return finished;
  }

  public void setFinished(boolean finished) {
    this.finished = finished;
  }
}
