package edu.cnm.deepdive.spaceseek.controller;

import android.content.Intent;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts.StartActivityForResult;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;
import androidx.lifecycle.LifecycleOwner;
import androidx.lifecycle.ViewModelProvider;
import androidx.navigation.Navigation;
import com.google.android.gms.auth.api.signin.GoogleSignInAccount;
import com.google.android.material.snackbar.Snackbar;
import dagger.hilt.android.AndroidEntryPoint;
import edu.cnm.deepdive.spaceseek.R;
import edu.cnm.deepdive.spaceseek.databinding.FragmentLoginBinding;
import edu.cnm.deepdive.spaceseek.viewmodel.LoginViewModel;

@AndroidEntryPoint
public class LoginFragment extends Fragment {

  private FragmentLoginBinding binding;
  private LoginViewModel viewModel;
  private ActivityResultLauncher<Intent> launcher;

  @Nullable
  @Override
  public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container,
      @Nullable Bundle savedInstanceState) {
    binding = FragmentLoginBinding.inflate(inflater, container, false);
    binding.signIn.setOnClickListener((v) -> viewModel.startSignIn(launcher));
    return binding.getRoot();
  }

  @Override
  public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
    super.onViewCreated(view, savedInstanceState);
    viewModel = new ViewModelProvider(requireActivity()).get(LoginViewModel.class);
    LifecycleOwner owner = getViewLifecycleOwner();
    viewModel.getAccount().observe(owner, this::handleAccount);
    viewModel.getSignInThrowable().observe(owner, this::handleThrowable);
    launcher = registerForActivityResult(new StartActivityForResult(), viewModel::completeSignIn);
  }

  private void handleAccount(GoogleSignInAccount account) {
    if (account != null) {
      Navigation.findNavController(binding.getRoot())
          .navigate(LoginFragmentDirections.navigateToImageFragment());
    }
  }

  private void handleThrowable(Throwable throwable) {
    if (throwable != null) {
      Snackbar.make(binding.getRoot(), R.string.sign_in_failure_message, Snackbar.LENGTH_LONG)
          .show();
    }
  }

  @Override
  public void onDestroyView() {
    binding = null;
    super.onDestroyView();
  }
}