package edu.cnm.deepdive.fizzbuzz.controller;

import android.os.Bundle;

import android.util.Log;
import androidx.activity.EdgeToEdge;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.navigation.NavController;
import androidx.navigation.fragment.NavHostFragment;
import androidx.navigation.ui.AppBarConfiguration;
import androidx.navigation.ui.NavigationUI;
import edu.cnm.deepdive.fizzbuzz.R;
import edu.cnm.deepdive.fizzbuzz.databinding.ActivityMainBinding;

public class MainActivity extends AppCompatActivity {

  private ActivityMainBinding binding;
  private NavController navController;
  private AppBarConfiguration appBarConfig;

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    binding = ActivityMainBinding.inflate(getLayoutInflater());
    setContentView(binding.getRoot());
    setUpNavigation();
    }

  @Override
  public boolean onSupportNavigateUp() {
    return NavigationUI.navigateUp(navController, appBarConfig);
    }

  private void setUpNavigation() {
    // DONE: 2/6/25 Get a reference to the NavHostFragment.
    NavHostFragment navHostFragment = (NavHostFragment)
        getSupportFragmentManager().findFragmentById(R.id.nav_host_fragment_container);
    // DONE: 2/6/25 Use NavHostFragment to get a reference to the NavController.
    //noinspection DataFlowIssue
    navController = navHostFragment.getNavController();
    // DONE: 2/6/25 Create an AppBarConfiguration, including all top-level destinations.
    appBarConfig = new AppBarConfiguration.Builder(R.id.game_fragment)
        .build();
    // DONE: 2/6/25 Connect the AppBarConfiguration with the NavController.
    NavigationUI.setupActionBarWithNavController(this, navController, appBarConfig);



  }
}





