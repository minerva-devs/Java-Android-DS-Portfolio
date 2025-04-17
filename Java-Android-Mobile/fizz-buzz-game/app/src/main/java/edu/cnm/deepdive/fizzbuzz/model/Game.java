package edu.cnm.deepdive.fizzbuzz.model;

import java.util.Collections;
import java.util.LinkedList;
import java.util.List;
import java.util.Random;
import java.util.Set;

@SuppressWarnings("unused")
public class Game {

  private final int length;
  private final int upperBound; // Inclusive
  private final int timeLimit; // Milliseconds
  private final Random rng;
  private final List<Round> rounds;

  private int correct;
  private int current;
///These are constructor parameters for all variables except rounds.
  public Game(int length, int upperBound, int timeLimit, Random rng) {
    this.length = length;
    this.upperBound = upperBound;
    this.timeLimit = timeLimit;
    this.rng = rng;
    rounds = new LinkedList<>();
  }

  public int startRound() {
    int next = rng.nextInt(upperBound) + 1;
    current = next;
    return next;
  }

  public boolean finishRound(Set<FizzBuzz> guess) {
    Round round = new Round(current, guess);
    rounds.add(round);
    boolean correct = round.isCorrect();
    if (correct) {
      this.correct++;
    }
    return correct;
  }

  public int getLength() {
    return length;
  }

  public int getUpperBound() {
    return upperBound;
  }

  public int getTimeLimit() {
    return timeLimit;
  }

  public List<Round> getRounds() {
    return Collections.unmodifiableList(rounds);
  }

  public int getCount() {
    return rounds.size();
  }

  public int getCorrect() {
    return correct;
  }

  public int getIncorrect() {
    return getCount() - correct;
  }

  public int getCurrent() {
    return current;
  }

  public boolean isRunning() {
    return getCount() < length;
  }

}
