package edu.cnm.deepdive.spaceseek.controller;

import android.os.Bundle;
import androidx.appcompat.app.AppCompatActivity;
import androidx.navigation.NavController;
import androidx.navigation.fragment.NavHostFragment;
import androidx.navigation.ui.AppBarConfiguration;
import androidx.navigation.ui.NavigationUI;
import dagger.hilt.android.AndroidEntryPoint;
import edu.cnm.deepdive.spaceseek.R;
import edu.cnm.deepdive.spaceseek.databinding.ActivityMainBinding;

@AndroidEntryPoint
public class MainActivity extends AppCompatActivity {

  private static final String TAG = MainActivity.class.getSimpleName();

  private ActivityMainBinding binding;
  private NavController navController;
  private AppBarConfiguration appBarConfig;

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    setupUI();
    setupNavigation();
  }

  @Override
  public boolean onSupportNavigateUp() {
    return NavigationUI.navigateUp(navController, appBarConfig);
  }

  private void setupUI() {
    // Inflate the layout using ViewBinding
    binding = ActivityMainBinding.inflate(getLayoutInflater());
    setContentView(binding.getRoot());
  }

  private void setupNavigation() {
    // Configure AppBar to include all top-level destinations
    appBarConfig = new AppBarConfiguration.Builder(
        R.id.calendar_fragment,
        R.id.image_fragment,
        R.id.settings_fragment,
        R.id.favorites_fragment // Include FavoritesFragment as a top-level destination
    ).build();

    // Obtain the NavController from the NavHostFragment
    navController = ((NavHostFragment) binding.navHostFragment.getFragment())
        .getNavController();

    // Set up ActionBar with the NavController and AppBarConfiguration
    NavigationUI.setupActionBarWithNavController(this, navController, appBarConfig);
  }

}