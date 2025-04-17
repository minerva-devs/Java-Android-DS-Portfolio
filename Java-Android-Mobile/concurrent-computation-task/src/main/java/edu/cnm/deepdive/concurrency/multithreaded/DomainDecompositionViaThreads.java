package edu.cnm.deepdive.concurrency.multithreaded;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.IntStream;

/**
 * Concrete subclass of {@link DomainDecomposition}, which spawns {@link Thread} instances on which
 * the natural logarithms are computed, and updates to the total are performed.
 */
public class DomainDecompositionViaThreads extends DomainDecomposition {
  private int partitions;
  private SharedMemoryUpdater updater;
  /**
   * Initializes this instance to use the specified number of partitions (of approximately equal
   * sizes) of the array processed by the {@link #process(int[])} method. At runtime, a
   * {@link Thread} will be created for each partition.
   *
   * @param partitions Number of sub-arrays.
   * @param updater Object performing the computations.
   */
  public DomainDecompositionViaThreads(int partitions, SharedMemoryUpdater updater) {
    super(partitions, updater);
    this.partitions = partitions;
    this.updater = updater;
  }

  @Override
  protected void process(int[] data) throws Exception {
    // TODO Implement these steps:
    //  1. For each partition in the data array:
    //     a. Compute the starting and ending indices (taking care to avoid gaps or overlaps).
    //     b. Create a Thread, passing to the constructor a Runnable consisting of an invocation of
    //        the process method on the updater, passing to that method the subarray bounds.
    //     c. Start the Thread, keeping a reference to it.
    //  3. Iterate over the created Threads, invoking the join method on each.

    int threshold = Math.ceilDiv(data.length, partitions);
    List<Thread> threads = new ArrayList<>();

    for(int partition = 0; partition < partitions; partition++) {
      int startIndex = partition * threshold;
      int endIndex = startIndex + threshold;
      Runnable task = () -> updater.process(data, startIndex, endIndex);
      Thread thread = new Thread(task);
      threads.add(thread);
      thread.start();
    }
    for(Thread thread : threads) {
      thread.join();
    }
  }

}
