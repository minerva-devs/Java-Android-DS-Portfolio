package edu.cnm.deepdive.farkle.controller;

import java.util.NoSuchElementException;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class ExceptionMapping {

  @ExceptionHandler(NoSuchElementException.class)
  @ResponseStatus(value = HttpStatus.NOT_FOUND, reason = "Specified Game not found")
  public void notFound() {}

  @ExceptionHandler(IllegalArgumentException.class)
  @ResponseStatus(value = HttpStatus.BAD_REQUEST, reason = "Selected dice not in roll, or not a scoring combination")
  public void badRequest() {}

  @ExceptionHandler(IllegalStateException.class)
  @ResponseStatus(value = HttpStatus.CONFLICT, reason = "Game is not in progress, or moving out of turn")
  public void conflict() {}

  @ExceptionHandler(NullPointerException.class)
  @ResponseStatus(value = HttpStatus.BAD_REQUEST, reason = "Improperly formatted roll action specified")
  public void invalidAction() {}
}
