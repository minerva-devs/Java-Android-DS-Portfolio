package edu.cnm.deepdive.concurrency.multithreaded.updater;

import edu.cnm.deepdive.concurrency.multithreaded.DomainDecomposition.SharedMemoryUpdater;
import java.util.Arrays;

/**
 * Concrete subclass of {@link SharedMemoryUpdater} which, in the {@link #process(int[], int, int)}
 * method, performs na&#239;updates of the shared sum of natural logarithms, without using locks (or
 * any other approach) for synchronization.
 */
public class RaceCondition extends SharedMemoryUpdater {

  @Override
  public void process(int[] data, int startIndex, int endIndex) {
    // TODO Implement these steps:
    //  1. For each element in data:
    //     a. Compute the natural logarithm of the element.
    //     b. Invoke the accumulate method to add the single value to the overall sum.
    Arrays.stream(data, startIndex, endIndex)
        .mapToDouble(Math::log)
        .forEach(this::accumulate);
  }

}
