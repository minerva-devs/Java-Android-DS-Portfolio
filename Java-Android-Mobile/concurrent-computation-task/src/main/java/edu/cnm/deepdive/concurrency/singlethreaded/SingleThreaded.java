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
package edu.cnm.deepdive.concurrency.singlethreaded;

import edu.cnm.deepdive.concurrency.IntStatsCalculator;
import java.util.Arrays;

/**
 * Implements a single-threaded computation of the geometric mean of the values in an
 * {@code int[]}.
 */
public class SingleThreaded implements IntStatsCalculator {

  /**
   * Computes the geometric mean of an {@code int[]} by iterating over the array, computing the
   * natural logarithm of each element value, computing the average of all of these logarithms, and
   * finally returning the result of raising <em>e</em> to the power given by the average logarithm.
   * The result is mathematically equivalent to taking the <em>n</em><sup>th</sup> root of the
   * product of the <em>n</em> values in the array&mdash;i.e., the geometric mean.
   *
   * @param data Values for which the geometric mean is computed.
   * @return Geometric mean of {@code data}.
   */
  @Override
  public double geometricMean(int[] data) {
    // TODO Implement these steps:
    //  1. For each element in data:
    //     a. Add the natural logarithm of element to the sum local variable.
    //  2. Compute and return the result of invoking Math.exp on the average natural logarithm
    //     computed above -- that is, the sum computed previously, divided by the number of elements
    //     in data.
    double sum;
    sum = Arrays.stream(data)
        .mapToDouble(Math::log)
        .sum();
    return Math.exp(sum / data.length);
  }

}
