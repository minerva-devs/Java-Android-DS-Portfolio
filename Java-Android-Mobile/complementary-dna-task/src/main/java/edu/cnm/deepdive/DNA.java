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

import java.util.Map;

/**
 * Includes the {@code static} methods {@link #complement(String)} and {@link #complement(String,
 * boolean)} methods, both of which implement a simple string converter that replaces the nucleobase
 * symbols ({@code A}, {@code T}, {@code C}, and {@code G}), with their respective complements
 * ({@code T}, {@code A}, {@code G}, and {@code C}, respectively), in a string representing a DNA
 * sequence/subsequence. Implementation of these methods is included as an assignment, extra credit
 * opportunity, or practical exam problem of the Deep Dive Coding Java training programs.
 */
public final class DNA {

  private static final Map<Character, Character> COMPLEMENTARY_PAIRS = Map.ofEntries(
      Map.entry('a', 't'),
      Map.entry('A', 'T'),

      Map.entry('t', 'a'),
      Map.entry('T', 'A'),

      Map.entry('c', 'g'),
      Map.entry('C', 'G'),

      Map.entry('g', 'c'),
      Map.entry('G', 'C')
  );

  private DNA() {
    // NOTE: There is NO need to do anything with this constructor! The methods you will implement
    // in this class are static; thus, there is no need to create instances of this class.
  }

  /* BASIC GOALS */

  /**
   * Converts and returns the DNA complement of {@code sequence}, with each nucleobase symbol
   * (character) replaced by its complementary symbol. This replacement is case-insensitive: the
   * input characters may be uppercase or lowercase, but the returned {@code String} will be
   * entirely lowercase.
   *
   * @param sequence DNA sequence.
   * @return Complementary DNA sequence.
   * @throws IllegalArgumentException If {@code sequence} contains any characters other than the
   *                                  allowed nucleobases.
   */
  public static String complement(String sequence) throws IllegalArgumentException {
    return complement(sequence, false);
  } //HAVE NOT STARTED THE TESTS FOR BASIC GOALS YET

  /* STRETCH GOALS */

  /**
   * Converts and returns the DNA complement of {@code sequence}, with each nucleobase symbol
   * (character) replaced by its complementary symbol. Optionally, the case of {@code sequence} is
   * respected, according to {@code respectCase}: if {@code true}, each character in
   * {@code sequence} is replaced by its complement of the same letter case; if {@code false}, all
   * characters in the returned value will be uppercase, regardless of the case of the characters in
   * {@code sequence}.
   *
   * @param sequence    DNA sequence.
   * @param respectCase Flag controlling the case of the returned value.
   * @return Complementary DNA sequence.
   * @throws IllegalArgumentException If {@code sequence} contains any characters other than the
   *                                  allowed nucleobases.
   */
  public static String complement(String sequence, boolean respectCase)
      throws IllegalArgumentException {
    int[] chars = sequence
        .chars()
        .map((codePoint) -> {
          if (!COMPLEMENTARY_PAIRS.containsKey((char) codePoint)) {
            throw new IllegalArgumentException();
          }
          return COMPLEMENTARY_PAIRS.get((char) codePoint);
        })
        .toArray();

    String complement = new String(chars, 0, chars.length);
    return respectCase ? complement : complement.toUpperCase();
  }

}