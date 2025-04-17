package edu.cnm.deepdive.concurrency.multithreaded;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.stream.IntStream;

/**
 * Concrete subclass of {@link DomainDecomposition}, which creates an {@link ExecutorService},
 * submitting to it the {@link Runnable}s on which the natural logarithms are computed, and updates
 * of the total are performed.
 */
public class DomainDecompositionViaExecutor extends DomainDecomposition {
  private final int partitions;
  private final SharedMemoryUpdater updater;

  /**
   * Initializes this instance to use the specified number of partitions (of approximately equal
   * sizes) of the array processed by the {@link #process(int[])} method. At runtime, a
   * {@link Runnable} is submitted to an {@link java.util.concurrent.ExecutorService} for each
   * partition.
   *
   * @param partitions Number of sub-arrays.
   * @param updater    Object performing the computations.
   */
  public DomainDecompositionViaExecutor(int partitions, SharedMemoryUpdater updater) {
    super(partitions, updater);
    this.partitions = partitions;
    this.updater = updater;
  }

  @Override
  protected void process(int[] data) throws Exception {
    // TODO Implement these steps:
    //  1. In a try-with-resources statement, create an ExecutorService (as the resource), using
    //     either a fixed thread pool service or a new-virtual-thread-per-task service.
    //  2. For each partition in the data array:
    //     a. Compute the starting and ending indices (taking care to avoid gaps or overlaps).
    //     b. Create a Runnable consisting of an invocation of the process method on the updater,
    //        passing to that method the subarray bounds.
    //     c. Submit the Runnable to the ExecutorService, holding on to a reference to the Future
    //        returned.
    //  3. Iterate over the Futures, invoking the get method on each.
    int threshold = Math.ceilDiv(data.length, partitions);
    List<Future<?>> futures = new ArrayList<>();
//array list with a list of futures- a promise that sometime later we will get information back,
//when we submit something to executor, we get futures back
    try(ExecutorService service = Executors.newFixedThreadPool(partitions)) {
      for(int partition = 0; partition < partitions; partition++) {
        int startIndex = partition * threshold;
        int endIndex = startIndex + threshold;
        Runnable task = () -> updater.process(data, startIndex, endIndex);
        futures.add(service.submit(task));
        }
      for(Future<?> future : futures) {
        future.get();
      }
    } catch (RuntimeException e) {
      throw new RuntimeException(e);
    }
  }

}

