package edu.cnm.deepdive.spaceseek.controller;

import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;
import androidx.fragment.app.Fragment;
import androidx.lifecycle.ViewModelProvider;
import com.google.android.material.snackbar.Snackbar;
import com.squareup.picasso.Callback;
import com.squareup.picasso.Picasso;
import dagger.hilt.android.AndroidEntryPoint;
import edu.cnm.deepdive.spaceseek.R;
import edu.cnm.deepdive.spaceseek.databinding.FragmentImageBinding;
import edu.cnm.deepdive.spaceseek.model.entity.Apod;
import edu.cnm.deepdive.spaceseek.viewmodel.ApodViewModel;
import javax.inject.Inject;

@AndroidEntryPoint
public class ImageFragment extends Fragment {

  private static final String TAG = ImageFragment.class.getSimpleName();

  @Inject
  Picasso picasso;
  private FragmentImageBinding binding;
  private ApodViewModel viewModel;
  private long apodId;

  @Override
  public void onCreate(@Nullable Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    if (getArguments() != null) {
      apodId = ImageFragmentArgs.fromBundle(getArguments()).getApodId();
    } else {
      apodId = 0;
    }
  }

  @Nullable
  @Override
  public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container,
      @Nullable Bundle savedInstanceState) {
    binding = FragmentImageBinding.inflate(inflater, container, false);
    return binding.getRoot();
  }

  @Override
  public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
    super.onViewCreated(view, savedInstanceState);
    ApodViewModel viewModel = new ViewModelProvider(requireActivity()).get(ApodViewModel.class);
    viewModel.setApodId(apodId);
    viewModel
        .getApod()
        .observe(getViewLifecycleOwner(), this::handleApod);
  }

  @Override
  public void onDestroyView() {
    binding = null;
    super.onDestroyView();
  }

  private void handleApod(Apod apod) {
    String title = apod
        .getTitle()
        .strip();
    //noinspection DataFlowIssue
    ((AppCompatActivity) requireActivity())
        .getSupportActionBar()
        .setTitle(title);
    binding.image.setTooltipText(title);
    binding.image.setContentDescription(title);
    picasso
        .load(apod.getLowDefUrl().toString())
        .into(binding.image, new ImageCallback());
  }

  private class ImageCallback implements Callback {

    @Override
    public void onSuccess() {
      binding.loadingIndicator.setVisibility(View.GONE);
    }

    //this will return an instance of snackbar, this isn't a static method
    //give it a view that Snackbar will attach to = binding.getRoot
    //extract to string resource = image_error_message
    @Override
    public void onError(Exception e) {
      Snackbar.make(binding.getRoot(), R.string.image_error_message,
              Snackbar.LENGTH_LONG) //the value of this expression is reference
          .show();
    }
  }

}
