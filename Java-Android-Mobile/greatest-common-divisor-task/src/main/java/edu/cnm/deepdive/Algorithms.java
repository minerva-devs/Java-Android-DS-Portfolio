/*
 *  Copyright 2025 CNM Ingenuity, Inc.
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
package edu.cnm.deepdive;

import java.util.Arrays;
import java.util.OptionalLong;
import java.util.stream.LongStream;

/**
 * Includes two static methods, {@link #gcd(long, long)} and {@link #(long...)}, which compute
 * the greatest common divisor of 2 or more {@code long} values. Implementation of these methods is
 * used as an assignment, practice, or practical problem in the Deep Dive Coding Java training
 * programs.
 */

public final class Algorithms {

  private Algorithms() {
    // NOTE: There is NO need to do anything with this constructor! The method
    //       you will implement in this class is static; thus, there is no need
    //       to create instances of this class.
  }

  /**
   * Computes and returns the greatest common divisor (GCD) of {@code a} and {@code b}.
   *
   * @param a First of pair of values for which GCD will be computed.
   * @param b Second of pair of values for which GCD will be computed.
   * @return GCD of {@code a} and {@code b}.
   */
  public static long gcd(long a, long b) {
    return (b == 0)
        ? Math.abs(a)
        : gcd(b, a % b);
  }


  public static long gcd(long... values) {
    return Arrays.stream(values)
      .reduce(0, Algorithms::gcd);
    }


  }


