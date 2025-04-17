package edu.cnm.deepdive.spaceseek.controller;

import android.os.Bundle;
import android.view.Menu;
import android.view.MenuItem;
import android.view.View;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.lifecycle.ViewModelProvider;
import androidx.navigation.NavController;
import androidx.navigation.fragment.NavHostFragment;
import androidx.navigation.ui.AppBarConfiguration;
import androidx.navigation.ui.NavigationUI;
import com.google.android.gms.auth.api.signin.GoogleSignInAccount;
import dagger.hilt.android.AndroidEntryPoint;
import edu.cnm.deepdive.spaceseek.R;
import edu.cnm.deepdive.spaceseek.databinding.ActivityMainBinding;
import edu.cnm.deepdive.spaceseek.viewmodel.ApodViewModel;
import edu.cnm.deepdive.spaceseek.viewmodel.LoginViewModel;

@AndroidEntryPoint
public class MainActivity extends AppCompatActivity {

  private static final String TAG = MainActivity.class.getSimpleName();

  private ActivityMainBinding binding;
  private NavController navController;
  private AppBarConfiguration appBarConfig;
  private LoginViewModel loginViewModel;
  private ApodViewModel apodViewModel;

  /**
   * @noinspection deprecation
   */
  private GoogleSignInAccount account;

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    setupUI(); // Inflate the layout and set the content view
    setupNavigation(); // Configure navigation for the app
    setupViewModel();
//    setupRandomApodButton();
    // Back Navigation Handling for API 33+
/*
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
          OnBackInvokedDispatcher.PRIORITY_DEFAULT,
          () -> navController.navigateUp()  //Ensures correct navigation instead of app closing
      );
    }
*/
  }

  @Override
  public boolean onSupportNavigateUp() {
    return NavigationUI.navigateUp(navController, appBarConfig);
  }

  private void setupUI() {
    // Inflated the layout using ViewBinding
    binding = ActivityMainBinding.inflate(getLayoutInflater());
    setContentView(binding.getRoot());
  }


  private void setupViewModel() {
    ViewModelProvider provider = new ViewModelProvider(this);
    loginViewModel = provider.get(LoginViewModel.class);
    loginViewModel
        .getAccount()
        .observe(this, account -> {
          binding.bottomNavigationView.setVisibility(account == null ? View.GONE : View.VISIBLE);
          this.account = account;
          invalidateOptionsMenu();
          //If account is null and in other fragments not pre-login or login, then navigate to pre-login
          int currentDest = navController.getCurrentDestination().getId();
          if (currentDest != R.id.pre_login_fragment && currentDest != R.id.login_fragment) {
            navController.navigate(R.id.pre_login_fragment);
          }
        });
    apodViewModel = provider.get(ApodViewModel.class);
  }

  
  private void setupNavigation() {
    // Configured AppBar to include all top-level destinations
    appBarConfig = new AppBarConfiguration.Builder(
        R.id.calendar_fragment,
        R.id.favorites_fragment,
        R.id.birthday_fragment
    ).build();
    // Obtained the NavController from the NavHostFragment
    navController = ((NavHostFragment) binding.navHostFragment.getFragment())
        .getNavController();
    // Set up ActionBar with the NavController and AppBarConfiguration
    NavigationUI.setupActionBarWithNavController(this, navController, appBarConfig);
    NavigationUI.setupWithNavController(binding.bottomNavigationView, navController);
  }

//  private void setupRandomApodButton() {
//    binding.randomButton.setOnClickListener(view -> apodViewModel.fetchRandomApod());
//  }


  //Show or hide sign out menu option depending on whether account field is null or not
  @Override
  public boolean onPrepareOptionsMenu(Menu menu) {
    if (menu != null) {
      MenuItem signOutItem = menu.findItem(R.id.sign_out);
      if (signOutItem != null) {
        signOutItem.setVisible(account != null);
      }
    }
    return super.onPrepareOptionsMenu(menu);
  }

  // Used getMenuInflater to inflate the menu resource with sign out option and attach to this menu
  @Override
  public boolean onCreateOptionsMenu(Menu menu) {
    getMenuInflater().inflate(R.menu.main_options, menu);
    return super.onCreateOptionsMenu(menu);
  }


  //  Check to see if sign_out option was selected, if so, invoke viewModelSignOut, viewModel will be doing the sign-out
  @Override
  public boolean onOptionsItemSelected(@NonNull MenuItem item) {
    if (item.getItemId() == R.id.sign_out) {
      loginViewModel.signOut();
      return true;
    }
    return super.onOptionsItemSelected(item);
  }

}