package edu.cnm.deepdive.farkle.model.dto;

import com.google.gson.annotations.Expose;
import java.util.LinkedList;
import java.util.List;

/**
 * @param frozenGroups Frozen dice groups.
 * @param finished     Whether the turn is finished.
 */
public record RollAction(@Expose List<int[]> frozenGroups, @Expose boolean finished) {

  public RollAction(List<int[]> frozenGroups, boolean finished) {
    this.frozenGroups = new LinkedList<>(frozenGroups);
    this.finished = finished;
  }

}
