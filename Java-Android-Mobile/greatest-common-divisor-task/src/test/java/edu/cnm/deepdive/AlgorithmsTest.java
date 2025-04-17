package edu.cnm.deepdive;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.stream.Stream;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

class AlgorithmsTest {

  @DisplayName("gcd(long, long")
  @ParameterizedTest(name = "[{index}] {arguments}")
  @MethodSource("basic_Cases")
  void gcdBasicCases(long a, long b, long expected) {
    assertEquals(expected, Algorithms.gcd(a, b));
  }

  private static Stream<Arguments> basic_Cases() {
    return Stream.of(
        Arguments.of(48L, 18L, 6L),
        Arguments.of(56L, 98L, 14L),
        Arguments.of(101L, 103L, 1L),
        Arguments.of(270L, 192L, 6L),
        Arguments.of(0L, 5L, 5L),
        Arguments.of(5L, 0L, 5L),
        Arguments.of(0L, 0L, 0L),
        Arguments.of(-48L, 18L, 6L),
        Arguments.of(48L, -18L, 6L),
        Arguments.of(-48L, -18L, 6L)
    );
  }

  @DisplayName("gcd(long...)")
  @ParameterizedTest
  @MethodSource("stretch_Cases")
  void gcdStretchCases(long[] values, long expected) {
    assertEquals(expected, Algorithms.gcd(values));
  }

  private static Stream<Arguments> stretch_Cases() {
    return Stream.of(
        Arguments.of(new long[]{}, 0L),
        Arguments.of(new long[]{49L}, 49L),
        Arguments.of(new long[]{49L, 49L}, 49L),
        Arguments.of(new long[]{182L, 78L}, 26L),
        Arguments.of(new long[]{182L, 70L, 49L}, 7L),
        Arguments.of(new long[]{70L, 56L, 182L}, 14L),
        Arguments.of(new long[]{55L, 182L, 70L}, 1L),
        Arguments.of(new long[]{70L, 56L, 0L, 182L}, 14L),
        Arguments.of(new long[]{180L, 98L, 63L, 77L, 35L}, 1L)
    );
  }

}

