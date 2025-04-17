package edu.cnm.deepdive.fizzbuzz.controller;

import android.os.Bundle;
import androidx.annotation.Nullable;
import androidx.preference.PreferenceFragmentCompat;
import edu.cnm.deepdive.fizzbuzz.R;

public class SettingsFragment extends PreferenceFragmentCompat {

  @Override
  public void onCreatePreferences(@Nullable Bundle bundle, @Nullable String rootKey) {
    setPreferencesFromResource(R.xml.settings, rootKey);
  }
}
