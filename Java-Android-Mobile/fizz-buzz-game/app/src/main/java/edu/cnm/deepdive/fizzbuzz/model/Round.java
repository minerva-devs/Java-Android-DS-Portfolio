package edu.cnm.deepdive.fizzbuzz.model;

import java.util.Set;

public record Round(int value, Set<FizzBuzz> guess) {

  public Round(int value, Set<FizzBuzz> guess) {
    this.value = value;
    this.guess = (guess !=null) ? Set.copyOf(guess) : null;

    /*if this COPY of guess is empty, the compiler will throw a null* ie this.guess = Set.copyOf(guess)*/
  }

  public boolean isCorrect() {
    return FizzBuzz.fizzOrBuzz(value).equals(guess);
  }
}
