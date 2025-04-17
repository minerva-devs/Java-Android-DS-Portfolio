package edu.cnm.deepdive.spaceseek.controller;

import android.content.SharedPreferences;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;
import androidx.lifecycle.LiveData;
import androidx.lifecycle.ViewModelProvider;
import androidx.navigation.Navigation;
import androidx.preference.PreferenceManager;
import androidx.recyclerview.widget.RecyclerView;
import dagger.hilt.android.AndroidEntryPoint;
import edu.cnm.deepdive.spaceseek.adapter.ListAdapter;
import edu.cnm.deepdive.spaceseek.databinding.FragmentListBinding;
import edu.cnm.deepdive.spaceseek.model.entity.Apod;
import edu.cnm.deepdive.spaceseek.viewmodel.ApodViewModel;
import java.util.List;

@AndroidEntryPoint
public class ListFragment extends Fragment {

  private FragmentListBinding binding;

  private RecyclerView favoritesRecyclerView;
  private ListAdapter adapter;
  private ApodViewModel viewModel;
  private ListType listType;

  @Override
  public void onCreate(@Nullable Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    listType = ListFragmentArgs.fromBundle(getArguments()).getListType();
  }

  @Nullable
  @Override
  public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container,
      @Nullable Bundle savedInstanceState) {
    binding = FragmentListBinding.inflate(inflater, container, false);
    return binding.getRoot();
  }


  @Override
  public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
    super.onViewCreated(view, savedInstanceState);
    viewModel = new ViewModelProvider(requireActivity()).get(ApodViewModel.class);
    // Retrieves APODs based on list type
    LiveData<List<Apod>> liveData;
    if (listType == ListType.FAVORITES) {
      liveData = viewModel.getFavorites();
    } else if (listType == ListType.BIRTHDAY) { // Fetch APODs for the user's birthday
      SharedPreferences sharedPreferences = PreferenceManager.getDefaultSharedPreferences(
          requireContext());
      String dob = sharedPreferences.getString("dob", ""); // Retrieves stored birthdate
      // Fallback in case no DOB is set
      if (!dob.isEmpty()) {
        viewModel.fetchApodsForDateAcrossYears(dob); // Calls ViewModel method to fetch APODs
      }
      liveData = viewModel.getApods(); // Ensures observed list updates correctly
    } else {
      liveData = viewModel.getApods();
    }

    liveData.observe(getViewLifecycleOwner(), this::setupRecyclerView);
  }


  private void setupRecyclerView(List<Apod> apods) {
    adapter = new ListAdapter(requireContext(), apods);
    binding.apods.setAdapter(adapter);
    adapter.setOnItemClickListener(this::onApodSelected);
  }

  private void onApodSelected(Apod apod) {
    Navigation.findNavController(binding.getRoot())
        .navigate(
            ListFragmentDirections.navigateToImageFragment()); //Ensures correct APOD is loaded
  }

  public enum ListType {

    FAVORITES, BIRTHDAY
  }
}