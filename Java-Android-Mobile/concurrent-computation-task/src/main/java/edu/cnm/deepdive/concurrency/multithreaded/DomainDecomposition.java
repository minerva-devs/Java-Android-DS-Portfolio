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

/**
 * Abstract superclass for a multithreaded computation, using domain decomposition, of the geometric
 * mean of the values in an {@code int[]}. Concrete subclasses must implement the
 * {@link #process(int[])} method, invoking {@link #accumulate(double)} to update a running total of
 * natural logarithms computed from the elements of the array.
 */
@SuppressWarnings("JavadocDeclaration")
public abstract class DomainDecomposition implements IntStatsCalculator {

  private final int partitions;
  private final SharedMemoryUpdater updater;

  private double sum;

  /**
   * Initializes this instance to use the specified number of partitions (of approximately equal
   * sizes) of the array processed by the {@link #process(int[])} method. At runtime, a
   * {@link Thread} will be created, or a {@link Runnable} submitted to an
   * {@link java.util.concurrent.ExecutorService}, for each partition.
   *
   * @param partitions Number of sub-arrays.
   * @param updater Object performing the computations.
   */
  public DomainDecomposition(int partitions, SharedMemoryUpdater updater) {
    this.partitions = partitions;
    this.updater = updater;
    updater.setContext(this);
  }

  /**
   * Computes the geometric mean of an {@code int[]} by partitioning the array and delegating the
   * computation of the sum of natural logarithms of {@code data} to the {@link #process(int[])}
   * method. On completion of that method, the sum is divided by {@code data.length} to get the
   * average logarithm; then <em>e</em> (the base of the natural logarithms) is raised to that
   * average value. The result is mathematically equivalent to taking the <em>n</em><sup>th</sup>
   * root of the product of the <em>n</em> values in the array&mdash;i.e., the geometric mean.
   *
   * @param data Values for which the geometric mean is computed.
   * @return Geometric mean of {@code data}.
   * @throws Exception If any of the threads computing a partial sum is interrupted.
   */
  @Override
  public double geometricMean(int[] data) throws Exception {
    sum = 0;
    process(data);
    return Math.exp(sum / data.length);
  }

  /**
   * Iterates over {@code data}, using any appropriate concurrency mechanism to decompose the array
   * into partitions, delegating the processing of all partitions to a {@link SharedMemoryUpdater},
   * but with each one executing on a separate {@link Thread}, or a separate {@link Runnable}
   * submitted to an {@link java.util.concurrent.ExecutorService}. The computations executed by the
   * {@link SharedMemoryUpdater} must include invocations (direct or indirect) of
   * {@link #accumulate(double)}, to update the overall sum of natural logarithms of the values in
   * {@code data}.
   *
   * @param data Values for which the geometric mean is computed.
   * @throws Exception If a thread involved in the computation is interrupted or cancelled.
   */
  protected abstract void process(int[] data) throws Exception;

  /**
   * Updates the running total of natural logarithms. This method is intended for use by a
   * subclass's override of the {@link #process(int[])} method.
   *
   * @param increment Amount by which the total should be increased.
   */
  protected final void accumulate(double increment) {
    sum += increment;
  }

  /**
   * Returns the number of partitions to use when decomposing the input data. This method is
   * intended for use by a subclass's override of the {@link #process(int[])} method.
   *
   * @return
   */
  public int getPartitions() {
    return partitions;
  }

  /**
   * Returns the {@link SharedMemoryUpdater} instance that will perform computations, with
   * concurrent updates (using {@link Thread} instances directly, or submitting {@link Runnable}
   * objects to an {@link java.util.concurrent.ExecutorService}) to the total of logarithms of the
   * input values.
   *
   * @return
   */
  public SharedMemoryUpdater getUpdater() {
    return updater;
  }

  /**
   *
   */
  public static abstract class SharedMemoryUpdater {

    private DomainDecomposition context;

    /**
     * Computes the natural logarithms of all elements in a sub-array of {@code data}, from
     * {@code startIndex} (inclusive) to {@code endIndex} (exclusive), accumulating them by invoking
     * {@link #accumulate(double)}.
     *
     * @param data Source data.
     * @param startIndex Starting position (inclusive) of sub-array.
     * @param endIndex Ending position (exclusive) of sub-array.
     */
    public abstract void process(int[] data, int startIndex, int endIndex);

    /**
     * Adds the specified {@code increment} to the sum of natural logarithms.
     *
     * @param increment
     */
    protected void accumulate(double increment) {
      context.accumulate(increment);
    }

    private void setContext(DomainDecomposition context) {
      this.context = context;
    }

  }

}
