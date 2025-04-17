package edu.cnm.deepdive.farkle.model.dto;

import com.google.gson.annotations.Expose;

public class Die {

  @Expose(serialize = false)
  private int value;

  @Expose(serialize = false)
  private int group;

  public int getValue() {
    return value;
  }

  public void setValue(int value) {
    this.value = value;
  }

  public int getGroup() {
    return group;
  }

  public void setGroup(int group) {
    this.group = group;
  }

}
