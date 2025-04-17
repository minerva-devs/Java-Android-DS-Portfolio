package edu.cnm.deepdive.farkle.controller;

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
import dagger.hilt.android.AndroidEntryPoint;
import edu.cnm.deepdive.farkle.R;
import edu.cnm.deepdive.farkle.viewmodel.LoginViewModel;
import java.util.Timer;
import java.util.TimerTask;

/**
 * @noinspection deprecation
 */
@AndroidEntryPoint
public class PreLoginFragment extends Fragment {

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
    }, 3500);
  }

  private void checkLoginState() {
    LoginViewModel viewModel = new ViewModelProvider(requireActivity())
        .get(LoginViewModel.class);
    LifecycleOwner owner = getViewLifecycleOwner();
    viewModel
        .getAccount()
        .observe(owner, this::handleAccount);
    viewModel
        .getRefreshThrowable()
        .observe(owner, this::handleThrowable);
    viewModel.refresh();
  }

  private void handleAccount(GoogleSignInAccount account) {
    if (account != null) {
      Navigation.findNavController(root)
          .navigate(PreLoginFragmentDirections.navigateToHomeFragment());
    }
  }

  private void handleThrowable(Throwable throwable) {
    if (throwable != null) {
      Navigation.findNavController(root)
          .navigate(PreLoginFragmentDirections.navigateToLoginFragment());
    }
  }

}
