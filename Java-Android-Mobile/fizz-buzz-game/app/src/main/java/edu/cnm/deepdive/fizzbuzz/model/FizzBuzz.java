package edu.cnm.deepdive.fizzbuzz.model;

import java.util.Set;
import java.util.EnumSet;

/**
 * DECLARE CLASS RESPONSIBILITY- Implements a single method (int)) to evaluate and {@code int} input,
 * to determine whether it is a Fizz (divisible by 3 but not 5), a Buzz (divisible by 5, but not 3),
 * a FizzBuzz (divisible by both 3 and 5), or neither.
 */

public enum FizzBuzz {

  FIZZ,
  BUZZ;


  public static final int FIZZ_DIVISOR = 3;
  public static final int BUZZ_DIVISOR = 5;


  /**
   * Evaluates input {@code value} to determine if it is a Fizz, Buzz, FizzBuzz, or neither, and
   * returns teh results of that evaluation. The result is expressed in terms of the constants
   * {@link #FIZZ}, {@link #BUZZ}.
   * @param value Input number
   * @return Resulting category fizz, buzz, both, or neither.
   */
  public static Set<FizzBuzz> fizzOrBuzz(int value) {
    Set<FizzBuzz> result = EnumSet.noneOf(FizzBuzz.class);
    if (value % FIZZ_DIVISOR == 0) {
      result.add(FIZZ); // Turn on the fizz bit (1 = 0b00000001)
    }
    if (value % BUZZ_DIVISOR == 0) {
      result.add(BUZZ); // Turn on the buzz bit (2 = 0b00000010)
    }
    return result;
  }

}
