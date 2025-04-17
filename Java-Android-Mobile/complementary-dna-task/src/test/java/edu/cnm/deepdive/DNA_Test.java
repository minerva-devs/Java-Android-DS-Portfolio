package edu.cnm.deepdive;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvFileSource;

class DNA_Test {

  @ParameterizedTest  // Basic Goal - Valid Cases
  @CsvFileSource(resources = "valid-case-convert.csv", useHeadersInDisplayName = true)
  void complement_basicGoal_valid(String sequence, String expected) {
    assertEquals(expected, DNA.complement(sequence));
  }

  @ParameterizedTest  // Basic Goal - Invalid Cases
  @CsvFileSource(resources = "invalid-case-convert.csv", useHeadersInDisplayName = true)
  void complement_basicGoal_invalid(String sequence, Class<? extends Throwable> expectedException) {
    assertThrows(expectedException, () -> DNA.complement(sequence));
  }

  @ParameterizedTest
  @CsvFileSource (resources = "Invalid-chars-explicit-respect.csv", useHeadersInDisplayName = true)
  void complement_invalidCharacters(
      String sequence, boolean respectCase, Class<? extends Throwable> expectedException) {
    assertThrows(expectedException, () -> DNA.complement(sequence, respectCase));
  }

  @ParameterizedTest
  @CsvFileSource (resources = "valid-chars-explicit-respect.csv", useHeadersInDisplayName = true)
  void complement_validCharacters(
      String sequence, boolean respectCase, String expected) {
    assertEquals(expected, DNA.complement(sequence, respectCase));
  }

}