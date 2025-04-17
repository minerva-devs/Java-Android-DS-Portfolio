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

import static org.junit.jupiter.api.Assertions.assertEquals;

import edu.cnm.deepdive.concurrency.multithreaded.DomainDecomposition;
import edu.cnm.deepdive.concurrency.multithreaded.DomainDecomposition.SharedMemoryUpdater;
import java.lang.reflect.Constructor;
import java.util.Random;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvFileSource;

public class IntStatsCalculatorTest {

  // TODO Explore different combinations of array length and # of partitions, including using
  //  system characteristics (e.g. Runtime.getRuntime().availableProcessors()) to control the number
  //  of slices of the array - and thus, the number of tasks or threads performing the computations.
  private static final int ARRAY_LENGTH = 10_000_000;
  private static final long RANDOM_SEED = 20_220_804_190_001L;
  private static final int LOWER_BOUND = 1;
  private static final int UPPER_BOUND = 1000;
  private static final double TOLERANCE_FRACTION = 0.000001;

  private static double expectedGeometricMean;
  private static int[] input;

  @BeforeAll
  static void generateTestData() {
    double[] sum = new double[1];
    input = new Random(RANDOM_SEED)
        .ints(ARRAY_LENGTH, LOWER_BOUND, UPPER_BOUND)
        .peek((value) -> sum[0] += Math.log(value))
        .toArray();
    expectedGeometricMean = Math.exp(sum[0] / ARRAY_LENGTH);
  }

  @ParameterizedTest(name = "[{index}] {0}")
  @CsvFileSource(resources = "implementation-classes.csv", numLinesToSkip = 1)
  void geometricMean(String name, Class<? extends IntStatsCalculator> calculatorImplementation,
      Class<? extends SharedMemoryUpdater> updaterImplementation, Integer numPartitions)
      throws Exception {
    IntStatsCalculator calculator =
        newInstance(calculatorImplementation, updaterImplementation, numPartitions);
    double actual = calculator.geometricMean(input);
    assertEquals(expectedGeometricMean, actual, expectedGeometricMean * TOLERANCE_FRACTION);
  }

  private IntStatsCalculator newInstance(
      Class<? extends IntStatsCalculator> calculatorImplementation,
      Class<? extends SharedMemoryUpdater> updaterImplementation,
      Integer numPartitions)
      throws ReflectiveOperationException {
    Constructor<? extends IntStatsCalculator> calculatorConstructor;
    IntStatsCalculator calculator;
    if (numPartitions == null) {
      calculatorConstructor = calculatorImplementation.getConstructor();
      calculator = calculatorConstructor.newInstance();
    } else if (updaterImplementation != null
        && DomainDecomposition.class.isAssignableFrom(calculatorImplementation)) {
      Constructor<? extends SharedMemoryUpdater> updaterConstructor =
          updaterImplementation.getConstructor();
      SharedMemoryUpdater updater = updaterConstructor.newInstance();
      calculatorConstructor =
          calculatorImplementation.getConstructor(int.class, SharedMemoryUpdater.class);
      calculator = calculatorConstructor.newInstance(numPartitions, updater);
    } else {
      calculatorConstructor = calculatorImplementation.getConstructor(int.class);
      calculator = calculatorConstructor.newInstance(numPartitions);
    }
    return calculator;
  }

}
