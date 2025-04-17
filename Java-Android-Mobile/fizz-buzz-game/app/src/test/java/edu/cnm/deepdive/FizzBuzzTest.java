package edu.cnm.deepdive;

import static org.junit.jupiter.api.Assertions.*;

import java.util.EnumSet;
import java.util.Set;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class FizzBuzzTest {

  private FizzBuzz fizzBuzz;

  @DisplayName("Fizz values")
  @ParameterizedTest
  @ValueSource(ints = {12, -3, 99, Integer.MAX_VALUE - 1, Integer.MIN_VALUE + 2})
  void fizzOrBuzz_fizz(int value) {
    assertEquals(Set.of(FizzBuzz.FIZZ), FizzBuzz.fizzOrBuzz(value));
  }

  @ParameterizedTest
  @ValueSource(ints = {25, -10, Integer.MAX_VALUE - 2, Integer.MIN_VALUE + 3})
  void fizzOrBuzz_buzz(int value) {
    assertEquals(Set.of(FizzBuzz.BUZZ), FizzBuzz.fizzOrBuzz(value));
  }

  @ParameterizedTest
  @ValueSource(ints = {0, 15, 90, -45, Integer.MAX_VALUE - 7})
  void fizzOrBuzz_fizzBuzz(int value) {
    assertEquals(EnumSet.allOf(FizzBuzz.class), FizzBuzz.fizzOrBuzz(value));
  }

  @ParameterizedTest
  @ValueSource(ints = {1, -1, 4, 7, Integer.MAX_VALUE, Integer.MIN_VALUE})
  void fizzOrBuzz_neither(int value) {
    assertEquals(EnumSet.noneOf(FizzBuzz.class), FizzBuzz.fizzOrBuzz(value));
  }


}




