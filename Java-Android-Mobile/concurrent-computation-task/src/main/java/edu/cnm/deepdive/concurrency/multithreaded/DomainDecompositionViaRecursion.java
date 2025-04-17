/*
 *  Copyright 2024 CNM Ingenuity, Inc.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
package edu.cnm.deepdive.concurrency.multithreaded;

import edu.cnm.deepdive.concurrency.IntStatsCalculator;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ForkJoinPool;
import java.util.concurrent.ForkJoinTask;
import java.util.concurrent.RecursiveTask;

/**
 * Implements a multithreaded computation of the geometric mean of the values in an {@code int[]}
 * using the divide-and-conquer approach, as supported by the fork-join framework in the Java
 * standard library.
 */
public class DomainDecompositionViaRecursion implements IntStatsCalculator {

  private final int numPartitions;

  /**
   * Initializes this instance by storing {@code numPartitions}, so that it (along with the length
   * of the array passed to the {@link #geometricMean(int[])} method) can be used to compute the
   * maximum partition size. This maximum size is used as the threshold for divide-and-conquer
   * recursion.
   *
   * @param numPartitions Number of partitions.
   */
  public DomainDecompositionViaRecursion(int numPartitions) {
    this.numPartitions = numPartitions;
  }

  /**
   * Computes the geometric mean of an {@code int[]} by delegating processing to a
   * {@link RecursiveTask RecursiveTask&lt;Double&gt;} worker, which uses a divide-and-conquer
   * approach to compute the result.
   *
   * @param data Values for which the geometric mean is computed.
   * @return Geometric mean of {@code data}.
   */
  @Override
  public double geometricMean(int[] data) {
    // TODO Implement the following steps:
    //  1. In a try-with-resources block, create a new ForkJoinPool, or (even better) obtain a
    //     reference to the common pool.
    //  2. Compute the fork threshold by rounding up from the computed partition size.
    //  3. Create new Worker instance, passing to it the full data array and the fork threshold.
    double sum = 0;
    int length = data.length;
    try (ForkJoinPool pool = ForkJoinPool.commonPool()) {
      int forkThreshold = Math.ceilDiv(length, numPartitions);   //this is the smallest value you can create before you start solving it yourself
      Worker worker = new Worker(data, 0, length, forkThreshold); //recursion starts here with creating forkThreshold, to find most efficient thread
      pool.invoke(worker); //now start process, at this point we've recursed to the lowest number for each thread
      sum = worker.get();
    } catch (RuntimeException | InterruptedException | ExecutionException e) {
      throw new RuntimeException(e);
    }
    return Math.exp(sum/length);
  }

  private static class Worker extends RecursiveTask<Double> {

    private final int[] data;
    private final int startIndex;
    private final int endIndex;
    private final int forkThreshold;

    private Worker(int[] data, int startIndex, int endIndex, int forkThreshold) {
      this.data = data;
      this.startIndex = startIndex;
      this.endIndex = endIndex;
      this.forkThreshold = forkThreshold;
    }

    /**
     * Computes and returns the sum of natural logarithms of all elements in the subarray of
     * {@code data} handled by this instance. If the size of the subarray does not exceed the
     * {@code forkThreshold} passed in the constructor invocation, then the computation is performed
     * directly by this method; otherwise, this method spawns two additional instances, each
     * handling one-half of this instance's subarray.
     *
     * @return Sum of natural logarithms of this worker's sub-array.
     */
    @Override
    protected Double compute() {
      // TODO Implement the following steps:
      //  1. Declare a sum local variable, and give it a reasonable initial value.
      //  2. If the subarray size is less than or equal to the fork threshold:
      //     a. For each element in data:
      //        - Add the natural logarithm of element to the sum local variable.
      //    Otherwise:
      //     a. Create two new Worker instances, each handling half of this instance's subarray.
      //     b. Gather the two instances into a Collection.
      //     c. Use the ForkJoinTask.invokeAll method to start the Worker instances in the
      //        collection.
      //     d. Iterate (explicitly or implicitly) over the collection, and invoke the join method
      //        on each Worker, to get the computed sum from that worker, adding that to the sum
      //        local variable.
      //  3. Return the value in the sum local variable.
      double sum = 0.0;

      if (endIndex - startIndex <= forkThreshold) {
        sum = Arrays.stream(data, startIndex, endIndex)
            .mapToDouble(Math::log)
            .sum();
      } else {
        int midIndex = (startIndex + endIndex) / 2;
        List<Worker> workers = new ArrayList<>();
        workers.add(new Worker(data, startIndex, midIndex, forkThreshold));
        workers.add(new Worker(data, midIndex, endIndex, forkThreshold));
        sum = ForkJoinTask.invokeAll(workers)
            .stream()
            .mapToDouble(worker -> worker.join())
            .sum();
      }
      return sum;
    }
  }

}
