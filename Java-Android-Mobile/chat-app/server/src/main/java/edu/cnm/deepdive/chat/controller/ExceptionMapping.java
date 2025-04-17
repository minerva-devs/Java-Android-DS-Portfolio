package edu.cnm.deepdive.chat.controller;

import java.util.NoSuchElementException;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class ExceptionMapping {

  @ExceptionHandler(NoSuchElementException.class)
  @ResponseStatus(value = HttpStatus.NOT_FOUND, reason = "Specified channel does not exist")
  public void channelNotFound() {
  }

  //if we fail validation, ie sending combination dice to freeze in farkle which aren't valid, fail validation
  @ExceptionHandler(IllegalArgumentException.class)
  @ResponseStatus(value = HttpStatus.BAD_REQUEST, reason = "Invalid request data")
  public void invalidRequest() {
  }

  @ExceptionHandler(IllegalStateException.class)
  @ResponseStatus(value = HttpStatus.CONFLICT, reason = "Game over!")
  public void gameOver() {
  }

}
