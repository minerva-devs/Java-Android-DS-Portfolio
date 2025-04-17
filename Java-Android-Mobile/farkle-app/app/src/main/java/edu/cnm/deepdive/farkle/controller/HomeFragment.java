package edu.cnm.deepdive.farkle.controller;

import android.os.Bundle;
import android.util.Log;
import android.view.LayoutInflater;
import android.view.Menu;
import android.view.MenuInflater;
import android.view.MenuItem;
import android.view.View;
import android.view.ViewGroup;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.core.view.MenuProvider;
import androidx.fragment.app.Fragment;
import androidx.lifecycle.Lifecycle.State;
import androidx.lifecycle.LifecycleOwner;
import androidx.lifecycle.ViewModelProvider;
import androidx.navigation.Navigation;
import dagger.hilt.android.AndroidEntryPoint;
import edu.cnm.deepdive.farkle.R;
import edu.cnm.deepdive.farkle.databinding.FragmentHomeBinding;
import edu.cnm.deepdive.farkle.viewmodel.GameViewModel;
import edu.cnm.deepdive.farkle.viewmodel.LoginViewModel;

@AndroidEntryPoint
public class HomeFragment extends Fragment implements MenuProvider {

  private static final String TAG = HomeFragment.class.getSimpleName();
  private FragmentHomeBinding binding;
  private LoginViewModel loginViewModel;
  private GameViewModel gameViewModel;

  @Nullable
  @Override
  public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container,
      @Nullable Bundle savedInstanceState) {
    binding = FragmentHomeBinding.inflate(inflater, container, false);
    return binding.getRoot();
  }

  @Override
  public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
    super.onViewCreated(view, savedInstanceState);
    loginViewModel = new ViewModelProvider(requireActivity())
        .get(LoginViewModel.class);

    loginViewModel
        .getAccount()
        .observe(getViewLifecycleOwner(), (account) -> {
          if (account != null) {
            Log.d(TAG, "Bearer " + account.getIdToken());
          } else {
            Navigation.findNavController(binding.getRoot())
                .navigate(HomeFragmentDirections.navigateToPreLoginFragment());
          }
        });
    LifecycleOwner owner = getViewLifecycleOwner();
    gameViewModel = new ViewModelProvider(requireActivity()).get(GameViewModel.class);

    binding.startGameButton.setOnClickListener(v -> {
      Log.d(TAG, "Start Game button clicked");
      Navigation.findNavController(binding.getRoot()
      ).navigate(HomeFragmentDirections.navigateToGameFragment());
    });

    requireActivity().addMenuProvider(this, getViewLifecycleOwner(), State.RESUMED);
  }

  @Override
  public void onDestroyView() {
    binding = null;
    super.onDestroyView();
  }

  @Override
  public void onCreateMenu(@NonNull Menu menu, @NonNull MenuInflater menuInflater) {
    menuInflater.inflate(R.menu.home_options, menu);
  }

  @Override
  public boolean onMenuItemSelected(@NonNull MenuItem menuItem) {
    boolean handled = false;
    if (menuItem.getItemId() == R.id.sign_out) {
      loginViewModel.signOut();
      handled = true;
    }
    return handled;
  }
}
