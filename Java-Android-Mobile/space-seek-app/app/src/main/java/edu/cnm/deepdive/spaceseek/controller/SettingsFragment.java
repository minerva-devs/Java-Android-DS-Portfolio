package edu.cnm.deepdive.spaceseek.controller;

import android.app.DatePickerDialog;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.util.Log;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.lifecycle.ViewModelProvider;
import androidx.preference.Preference;
import androidx.preference.PreferenceFragmentCompat;
import androidx.preference.PreferenceManager;
import edu.cnm.deepdive.spaceseek.R;
import edu.cnm.deepdive.spaceseek.viewmodel.ApodViewModel;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import org.jetbrains.annotations.NotNull;

public class SettingsFragment extends PreferenceFragmentCompat {

  private static final String TAG = SettingsFragment.class.getSimpleName();
  private SharedPreferences.OnSharedPreferenceChangeListener listener;

  @Override
  public void onCreatePreferences(@Nullable Bundle savedInstanceState, String rootKey) {
    setPreferencesFromResource(R.xml.preferences, rootKey); // Loads preferences dynamically
  }

  @Override
  public void onResume() {
    super.onResume();
    SharedPreferences preferences = PreferenceManager.getDefaultSharedPreferences(requireContext());
    listener = (sharedPreferences, key) -> {
      switch (key) {
        case "dark_mode":
          boolean isDarkMode = sharedPreferences.getBoolean(key, false);
          applyTheme(isDarkMode);
          break;
        case "notifications":
          // TODO: 4/1/2025 Future notification handling here
          break;
        case "dob": //Handles DatePreference instead of manual input TextPreference
          String dob = sharedPreferences.getString(key, "");
          if (isValidDate(dob)) {
            fetchPersonalizedApods(dob);
          } else {
            Log.w(TAG, "Invalid date format for DOB: " + dob);
          }
          break;
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

  @Override
  public void onDisplayPreferenceDialog(@NonNull @NotNull Preference preference) {
    if ("dob".equals(preference.getKey())) {
      showDatePickerDialog(preference); // Opens DatePickerDialog
    } else {
      super.onDisplayPreferenceDialog(preference);
    }
  }

  private void showDatePickerDialog(Preference preference) {
    // Retrieves saved DOB or defaults to today's date
    SharedPreferences sharedPreferences = PreferenceManager.getDefaultSharedPreferences(
        requireContext());
    String savedDate = sharedPreferences.getString("dob", "");
    LocalDate defaultDate = savedDate.isEmpty() ? LocalDate.now() : LocalDate.parse(savedDate);

    // Displays DatePickerDialog with correct initial selection
    new DatePickerDialog(requireContext(), (view, year, month, dayOfMonth) -> {
      String selectedDate = year + "-" + (month + 1) + "-" + dayOfMonth;
      sharedPreferences.edit().putString("dob", selectedDate).apply();
      preference.setSummary(selectedDate); // Updates preference UI immediately
    }, defaultDate.getYear(), defaultDate.getMonthValue() - 1, defaultDate.getDayOfMonth()).show();
  }

  private boolean isValidDate(String dob) {
    try {
      LocalDate.parse(dob); // Validate if the input matches the ISO-8601 date format
      return true;
    } catch (DateTimeParseException e) {
      return false;
    }
  }

  private void applyTheme(boolean isDarkMode) {
    int themeId = isDarkMode ? R.style.AppTheme_Dark : R.style.AppTheme_Light;
    requireActivity().setTheme(themeId);
    requireActivity().recreate(); // TODO: Replace activity recreation with selective UI updates
  }

  private void fetchPersonalizedApods(String dob) {
    ApodViewModel viewModel = new ViewModelProvider(requireActivity()).get(ApodViewModel.class);
    viewModel.fetchApodsForDateAcrossYears(dob); // Fetch personalized APODs for the given DOB
  }

}