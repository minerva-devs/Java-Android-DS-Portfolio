package edu.cnm.deepdive.farkle.service;

import java.util.List;
import java.util.Map;
import javax.inject.Inject;
import javax.inject.Singleton;

@Singleton
public class ScoreMaster {

  private static final Map<List<Integer>, Integer> FARKLE_SCORES = Map.ofEntries(
      Map.entry(List.of(1), 100),
      Map.entry(List.of(5), 50),
      Map.entry(List.of(1, 1, 1), 1000),
      Map.entry(List.of(2, 2, 2), 200),
      Map.entry(List.of(3, 3, 3), 300),
      Map.entry(List.of(4, 4, 4), 400),
      Map.entry(List.of(5, 5, 5), 500),
      Map.entry(List.of(6, 6, 6), 600),
      Map.entry(List.of(1, 1, 1, 1), 1000),
      Map.entry(List.of(2, 2, 2, 2), 1000),
      Map.entry(List.of(3, 3, 3, 3), 1000),
      Map.entry(List.of(4, 4, 4, 4), 1000),
      Map.entry(List.of(5, 5, 5, 5), 1000),
      Map.entry(List.of(6, 6, 6, 6), 1000),
      Map.entry(List.of(1, 1, 1, 1, 1), 2000),
      Map.entry(List.of(2, 2, 2, 2, 2), 2000),
      Map.entry(List.of(3, 3, 3, 3, 3), 2000),
      Map.entry(List.of(4, 4, 4, 4, 4), 2000),
      Map.entry(List.of(5, 5, 5, 5, 5), 2000),
      Map.entry(List.of(6, 6, 6, 6, 6), 2000),
      Map.entry(List.of(1, 1, 1, 1, 1, 1), 3000),
      Map.entry(List.of(2, 2, 2, 2, 2, 2), 3000),
      Map.entry(List.of(3, 3, 3, 3, 3, 3), 3000),
      Map.entry(List.of(4, 4, 4, 4, 4, 4), 3000),
      Map.entry(List.of(5, 5, 5, 5, 5, 5), 3000),
      Map.entry(List.of(6, 6, 6, 6, 6, 6), 3000),
      Map.entry(List.of(1, 2, 3, 4, 5, 6), 1500),
      Map.entry(List.of(1, 1, 2, 2, 3, 3), 1500),
      Map.entry(List.of(1, 1, 2, 2, 4, 4), 1500),
      Map.entry(List.of(1, 1, 2, 2, 5, 5), 1500),
      Map.entry(List.of(1, 1, 2, 2, 6, 6), 1500),
      Map.entry(List.of(1, 1, 3, 3, 4, 4), 1500),
      Map.entry(List.of(1, 1, 3, 3, 5, 5), 1500),
      Map.entry(List.of(1, 1, 3, 3, 6, 6), 1500),
      Map.entry(List.of(1, 1, 4, 4, 5, 5), 1500),
      Map.entry(List.of(1, 1, 4, 4, 6, 6), 1500),
      Map.entry(List.of(1, 1, 5, 5, 6, 6), 1500),
      Map.entry(List.of(2, 2, 3, 3, 4, 4), 1500),
      Map.entry(List.of(2, 2, 3, 3, 5, 5), 1500),
      Map.entry(List.of(2, 2, 3, 3, 6, 6), 1500),
      Map.entry(List.of(2, 2, 4, 4, 5, 5), 1500),
      Map.entry(List.of(2, 2, 4, 4, 6, 6), 1500),
      Map.entry(List.of(2, 2, 5, 5, 6, 6), 1500),
      Map.entry(List.of(3, 3, 4, 4, 5, 5), 1500),
      Map.entry(List.of(3, 3, 4, 4, 6, 6), 1500),
      Map.entry(List.of(3, 3, 5, 5, 6, 6), 1500),
      Map.entry(List.of(4, 4, 5, 5, 6, 6), 1500)
      // TODO: 4/2/25 Confirm that this table is complete.
  );

  @Inject
  ScoreMaster() {
  }

  public int getScore(List<Integer> group) {
    //noinspection DataFlowIssue
    return FARKLE_SCORES.getOrDefault(group, 0);
  }
}
