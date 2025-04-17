package edu.cnm.deepdive.notes.controller;

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
import androidx.appcompat.widget.PopupMenu;
import androidx.core.view.MenuProvider;
import androidx.fragment.app.Fragment;
import androidx.lifecycle.Lifecycle.State;
import androidx.lifecycle.LifecycleOwner;
import androidx.lifecycle.ViewModelProvider;
import androidx.navigation.Navigation;
import com.google.android.gms.auth.api.signin.GoogleSignInAccount;
import dagger.hilt.android.AndroidEntryPoint;
import edu.cnm.deepdive.notes.R;
import edu.cnm.deepdive.notes.adapter.NotesAdapter;
import edu.cnm.deepdive.notes.databinding.FragmentHomeBinding;
import edu.cnm.deepdive.notes.model.entity.Note;
import edu.cnm.deepdive.notes.viewmodel.LoginViewModel;
import edu.cnm.deepdive.notes.viewmodel.NoteViewModel;
import java.util.List;

/** @noinspection deprecation*/
@AndroidEntryPoint
public class HomeFragment extends Fragment implements MenuProvider {

  private static final String TAG = HomeFragment.class.getSimpleName();

  private FragmentHomeBinding binding;
  private NoteViewModel noteViewModel;
  private LoginViewModel loginViewModel;

  @Override
  public void onCreate(@Nullable Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
  }

  @Override
  public View onCreateView(
      @NonNull LayoutInflater inflater, ViewGroup container, Bundle savedInstanceState) {
    binding = FragmentHomeBinding.inflate(inflater, container, false);
    binding.newNote.setOnClickListener((v) -> Navigation.findNavController(binding.getRoot())
        .navigate(HomeFragmentDirections.openEditFragment()));
            // Inflate the layout for this fragment
    return binding.getRoot();
  }
  // DONE: 2/13/25 If creating a new adapter each time the data changes, create one now;
  //  otherwise we need to create one earlier, and it will exist by this time.
  // DONE: 2/13/25 Pass notes to adapter.
  // DONE: 2/13/25 Notify adapter of change.

  //create an instance of an adapter, attach it to the recyclerview so it knows who to get data from
  @Override
  public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
    super.onViewCreated(view, savedInstanceState);
    LifecycleOwner lifecycleOwner = getViewLifecycleOwner();
    ViewModelProvider provider = new ViewModelProvider(requireActivity());
    noteViewModel = provider.get(NoteViewModel.class);
    noteViewModel
        .getNotes()
        .observe(lifecycleOwner, this::handleMethods);
    loginViewModel = provider.get(LoginViewModel.class);
    loginViewModel
        .getAccount()
        .observe(lifecycleOwner, this::handleAccount);
    requireActivity().addMenuProvider(this, lifecycleOwner, State.RESUMED);
  }

  @Override
  public void onDestroyView() {
    binding = null;
    super.onDestroyView();
  }

  private void handleMethods(List<Note> notes) {
    NotesAdapter adapter;
    adapter = new NotesAdapter(requireContext(), notes, (v,note, position) -> {
      PopupMenu popup = new PopupMenu(requireContext(), v);
      Menu menu = popup.getMenu();
      popup.getMenuInflater().inflate(R.menu.note_options, popup.getMenu());
      menu
          .findItem(R.id.edit_note)
          .setOnMenuItemClickListener(item -> {
            Log.d(TAG, String.format("onMenuItemClick: item=%s", item.getTitle()));
            Navigation.findNavController(binding.getRoot())
                .navigate(HomeFragmentDirections.openEditFragment().setNoteId(note.getId()));
            return true; //indicates the menu has been handled
          });
      menu
          .findItem(R.id.delete_note)
          .setOnMenuItemClickListener((item) -> {
            Log.d(TAG, String.format("onMenuItemClick: item=%s", item.getTitle()));
            noteViewModel.delete(note);
//            adapter.notifyItemRemoved(position);
            return true;
          });
      popup.show();
      return true;
    });
    binding.notes.setAdapter(adapter);
  }

  private void handleAccount(GoogleSignInAccount account) {
    if (account == null) {
      Navigation.findNavController(binding.getRoot())
          .navigate(HomeFragmentDirections.navigateToPreLoginFragment());
    }
  }

  @Override
  public void onCreateMenu(@NonNull Menu menu, @NonNull MenuInflater menuInflater) {
    menuInflater.inflate(R.menu.note_actions, menu);
  }

  @Override
  public boolean onMenuItemSelected(@NonNull MenuItem menuItem) {
    boolean handled = true;
    if (menuItem.getItemId() == R.id.sign_out) {
      loginViewModel.signOut();
    } else {
      handled = false;
    }
    return handled;
  }
}