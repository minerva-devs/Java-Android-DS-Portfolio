package edu.cnm.deepdive.farkle.controller;

import android.os.Bundle;
import androidx.appcompat.app.AppCompatActivity;
import androidx.navigation.NavController;
import androidx.navigation.fragment.NavHostFragment;
import androidx.navigation.ui.AppBarConfiguration;
import androidx.navigation.ui.NavigationUI;
import dagger.hilt.android.AndroidEntryPoint;
import edu.cnm.deepdive.farkle.R;
import edu.cnm.deepdive.farkle.databinding.ActivityMainBinding;

@AndroidEntryPoint
public class MainActivity extends AppCompatActivity {

  private ActivityMainBinding binding;
  private NavController navController;
  private AppBarConfiguration appBarConfig;

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    binding = ActivityMainBinding.inflate(getLayoutInflater());
    setContentView(binding.getRoot());

    setupNavigation();
  }

  @Override
  public boolean onSupportNavigateUp() {
    return NavigationUI.navigateUp(navController, appBarConfig);
  }

  private void setupNavigation() {
    setSupportActionBar(binding.toolbar);
    appBarConfig = new AppBarConfiguration.Builder(R.id.home_fragment, R.id.pre_login_fragment,
        R.id.login_fragment, R.id.game_fragment)
        .build();
    navController = ((NavHostFragment) binding.navHostContainer.getFragment()).getNavController();
    NavigationUI.setupActionBarWithNavController(this, navController, appBarConfig);
  }
}