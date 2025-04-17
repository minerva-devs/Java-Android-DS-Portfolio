package edu.cnm.deepdive.concurrency.multithreaded.updater;

import edu.cnm.deepdive.concurrency.multithreaded.DomainDecomposition.SharedMemoryUpdater;
import java.util.Arrays;

/**
 * Concrete subclass of {@link SharedMemoryUpdater} which, in the {@link #process(int[], int, int)}
 * method, performs a single update of the shared sum of natural logarithms, thus reducing the need
 * for locking to a single update per partition.
 */
public class Reduction extends SharedMemoryUpdater {

  private final String lock = new String("lock");

  // TODO Declare and assign an object suitable for use as a locking object. (Hint: the field should
  //  be final, and the object should have no mutable state; aside from that, almost any type of
  //  object will work.)

  @Override
  public void process(int[] data, int startIndex, int endIndex) {
    // TODO Implement these steps:
    //  1. Declare a sum local variable, assigning it a reasonable initial value.
    //  2. For each element in data:
    //     a. Compute the natural logarithm of the element and add it to the local sum.
    //  3. In a block synchronized using the above lock object, invoke the accumulate method to
    //     add the local sum to the overall sum.
    double sum = 0;
    sum = Arrays.stream(data,startIndex, endIndex)
        .mapToDouble(Math::log)
        .sum();

    synchronized (lock) {
      accumulate(sum);
    }


  }

}
