package edu.cnm.deepdive.spaceseek.controller;

import android.content.SharedPreferences;
import android.os.Bundle;
import androidx.annotation.Nullable;
import androidx.preference.PreferenceFragmentCompat;
import androidx.preference.PreferenceManager;
import edu.cnm.deepdive.spaceseek.R;


public class SettingsFragment extends PreferenceFragmentCompat {

  private SharedPreferences.OnSharedPreferenceChangeListener listener;

  @Override
  public void onCreatePreferences(@Nullable Bundle savedInstanceState, String rootKey) {
    setPreferencesFromResource(R.xml.preferences, rootKey); //load preferences dynamically
  }

  @Override
  public void onResume() {
    super.onResume();
    SharedPreferences preferences = PreferenceManager.getDefaultSharedPreferences(requireContext());
    listener = (sharedPreferences, key) -> {
      if ("dark_mode".equals(key)) {
        boolean isDarkMode = sharedPreferences.getBoolean(key, false);
        applyTheme(isDarkMode);
      }
    };
    preferences.registerOnSharedPreferenceChangeListener(listener);
  }

  @Override
  public void onPause() {
    super.onPause();
    SharedPreferences preferences = PreferenceManager.getDefaultSharedPreferences(requireContext());
    preferences.unregisterOnSharedPreferenceChangeListener(listener);
  }

  private void applyTheme(boolean isDarkMode) {
    int themeId = isDarkMode ? R.style.AppTheme_Dark : R.style.AppTheme_Light;
    requireActivity().setTheme(themeId);
    requireActivity().recreate();
  }

}