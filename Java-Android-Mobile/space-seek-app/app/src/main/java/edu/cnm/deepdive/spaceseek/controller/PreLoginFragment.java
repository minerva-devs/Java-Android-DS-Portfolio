package edu.cnm.deepdive.spaceseek.controller;

import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;
import androidx.lifecycle.LifecycleOwner;
import androidx.lifecycle.ViewModelProvider;
import androidx.navigation.Navigation;
import com.google.android.gms.auth.api.signin.GoogleSignInAccount;
import edu.cnm.deepdive.spaceseek.R;
import edu.cnm.deepdive.spaceseek.viewmodel.LoginViewModel;
import java.util.Timer;
import java.util.TimerTask;

public class PreLoginFragment extends Fragment {

  private LoginViewModel viewModel;
  private View root;

  @Nullable
  @Override
  public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container,
      @Nullable Bundle savedInstanceState) {
    root = inflater.inflate(R.layout.fragment_pre_login, container, false);
    return root;
  }

  @Override
  public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
    super.onViewCreated(view, savedInstanceState);

    Timer timer = new Timer();
    timer.schedule(new TimerTask() {

      @Override
      public void run() {
        requireActivity().runOnUiThread(PreLoginFragment.this::checkLoginState);
      }
    }, 3000);
  }

  private void checkLoginState() {
    viewModel = new ViewModelProvider(requireActivity()).get(LoginViewModel.class);
    LifecycleOwner owner = getViewLifecycleOwner();
    viewModel.getAccount().observe(owner, this::handleAccount);
    viewModel.getRefreshThrowable().observe(owner, this::handleThrowable);
    viewModel.refresh();
  }

  private void handleAccount(GoogleSignInAccount account) {
    if (account != null && root != null) {
      Navigation.findNavController(root)
          .navigate(PreLoginFragmentDirections.navigateToImageFragment());
    }
  }

  private void handleThrowable(Throwable throwable) {
    if (throwable != null) {
      Navigation.findNavController(root)
          .navigate(PreLoginFragmentDirections.navigateToLoginFragment());
    }
  }
}