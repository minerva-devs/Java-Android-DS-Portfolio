package edu.cnm.deepdive.concurrency.multithreaded.updater;

import edu.cnm.deepdive.concurrency.multithreaded.DomainDecomposition.SharedMemoryUpdater;
import java.util.Arrays;

/**
 * Concrete subclass of {@link SharedMemoryUpdater} which, in the {@link #process(int[], int, int)}
 * method, performs an update of the shared sum of natural logarithms for each logarithm computed,
 * using a lock to synchronize the update and prevent race conditions.
 */
public class CriticalSection extends SharedMemoryUpdater {

  public final Object lock = new Object(); //we're saying the reference to this object is final

  // TODO Declare and assign an object suitable for use as a locking object. (Hint: the field should
  //  be final, and the object should have no mutable state; aside from that, almost any type of
  //  object will work.)

  @Override
  public void process(int[] data, int startIndex, int endIndex) {
    // TODO Implement these steps:
    //  1. For each element in data:
    //     a. Compute the natural logarithm of the element.
    //     b. In a block synchronized using the above lock object, invoke the accumulate method to
    //        add the single value to the overall sum.
    Arrays.stream(data, startIndex, endIndex)
        .mapToDouble(Math::log)
        .forEach((sum) -> {
          synchronized (lock) {
            accumulate(sum);
          }
            });

  }

}
