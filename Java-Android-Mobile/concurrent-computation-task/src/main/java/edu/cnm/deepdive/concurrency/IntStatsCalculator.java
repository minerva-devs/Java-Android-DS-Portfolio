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
package edu.cnm.deepdive.concurrency;

/**
 * Declares the {@link #geometricMean(int[])} method, which must be implemented in all non-abstract
 * implementations of this interface.
 */
public interface IntStatsCalculator {

  /**
   * Computes and returns the geometric mean of the specified {@code int[]}.
   *
   * @param data Values for which the geometric mean is computed.
   * @return Geometric mean of {@code data}.
   * @throws Exception If a thread involved in the computation is interrupted or cancelled.
   */
  double geometricMean(int[] data) throws Exception;

}
