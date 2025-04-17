package edu.cnm.deepdive.fizzbuzz.controller;

import android.content.res.Resources.Theme;
import android.os.Bundle;
import android.util.Log;
import android.util.TypedValue;
import android.view.LayoutInflater;
import android.view.Menu;
import android.view.MenuInflater;
import android.view.MenuItem;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.CompoundButton;
import android.widget.ToggleButton;
import androidx.annotation.ColorInt;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.core.view.MenuProvider;
import androidx.fragment.app.Fragment;
import androidx.lifecycle.Lifecycle.State;
import androidx.lifecycle.LifecycleOwner;
import androidx.lifecycle.ViewModelProvider;
import androidx.navigation.NavController;
import androidx.navigation.Navigation;
import edu.cnm.deepdive.fizzbuzz.R;
import edu.cnm.deepdive.fizzbuzz.databinding.FragmentGameBinding;
import edu.cnm.deepdive.fizzbuzz.model.FizzBuzz;
import edu.cnm.deepdive.fizzbuzz.viewmodel.GameViewModel;
import java.util.Arrays;
import java.util.Set;
import org.jetbrains.annotations.NotNull;

public class GameFragment extends Fragment implements MenuProvider {

  private static final String TAG = GameFragment.class.getSimpleName();

  private FragmentGameBinding binding;
  private GameViewModel viewModel;
  private ToggleButton[] choices;
  @ColorInt
  private int correctColor;
  @ColorInt
  private int incorrectColor;
  private boolean running;

  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    // TODO: 2025-02-03 Retrieve any arguments passed in to this fragment.
    correctColor = getColor(R.attr.colorCorrect);
    incorrectColor = getColor(R.attr.colorIncorrect);
  }

  @Override
  public View onCreateView(
      @NonNull LayoutInflater inflater, ViewGroup container, Bundle savedInstanceState) {
    binding = FragmentGameBinding.inflate(inflater, container, false);
    // TODO: 2025-02-03 Modify widget contents and attach listeners, as appropriate.
    choices = new ToggleButton[]{binding.neither, binding.fizz, binding.buzz, binding.fizzBuzz};
    binding.neither.setTag(Set.of());
    binding.fizz.setTag(Set.of(FizzBuzz.FIZZ));
    binding.buzz.setTag(Set.of(FizzBuzz.BUZZ));
    binding.fizzBuzz.setTag(Set.of(FizzBuzz.FIZZ, FizzBuzz.BUZZ));
    binding.neither.setOnCheckedChangeListener(this::handleToggle);
    binding.fizz.setOnCheckedChangeListener(this::handleToggle);
    binding.buzz.setOnCheckedChangeListener(this::handleToggle);
    binding.fizzBuzz.setOnCheckedChangeListener(this::handleToggle);
    return binding.getRoot();
  }

  @Override
  public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
    super.onViewCreated(view, savedInstanceState);
    // TODO: 2025-02-03 Get a reference to each relevant viewmodel, and attach observer.
    viewModel = new ViewModelProvider(requireActivity()).get(GameViewModel.class);
    LifecycleOwner owner = getViewLifecycleOwner();
    viewModel
        .getGame()
        .observe(owner, (game) -> {
          if (game != null && game.isRunning()) {
            binding.current.setText(String.valueOf(game.getCurrent()));
          } else {
            binding.current.setText("");
          }
          if (game != null) {
            binding.progress.setMax(game.getLength());
            binding.progress.setProgress(game.getCorrect());
            binding.progress.setSecondaryProgress(game.getCount());
          } else {
            binding.progress.setSecondaryProgress(0);
            binding.progress.setProgress(0);
          }
          // TODO: 2025-02-03 Update state of view widgets with data from game.
        });
    viewModel
        .getCount()
        .observe(owner, (count) -> {
          // TODO: 2025-02-03 Start a new round if the game isn't over.
          Arrays.stream(choices)
              .forEach((choice) -> choice.setChecked(false));
        });
    viewModel
        .getRunning()
        .observe(owner, (running) -> {
          this.running = running;
          requireActivity().invalidateOptionsMenu();
          // TODO: 2025-02-03 Enable/disable controls as appropriate for game running (or not).
          binding.timerDisplay.setVisibility(running ? View.VISIBLE : View.GONE);
        });
    viewModel
        .getElapsedFraction()
        .observe(owner, (elapsedFraction) -> {
          int timerWidth = Math.min(
              binding.buzz.getLeft() - binding.fizz.getRight(),
              binding.fizzBuzz.getTop() - binding.neither.getBottom()
          );
          binding.timerDisplay.setIndicatorSize(timerWidth);
          int max = binding.timerDisplay.getMax();
          binding.timerDisplay.setProgress((int) Math.round(max - elapsedFraction * max));
        });
    viewModel
        .getThrowable()
        .observe(owner, (throwable) -> {
          // TODO: 2025-02-03 Notify user as appropriate.
        });
    requireActivity().addMenuProvider(this, getViewLifecycleOwner(), State.RESUMED);
  }

  @Override
  // DONE: 2025-02-05 Iterate over toggle buttons, to uncheck all that aren't target.
  public void onCreateMenu(@NonNull Menu menu, @NonNull MenuInflater menuInflater) {
    menuInflater.inflate(R.menu.game_options, menu);
  }

  @Override
  public boolean onMenuItemSelected(@NonNull MenuItem menuItem) {
    boolean handled = true;
    int itemId = menuItem.getItemId();
    if (itemId == R.id.start_game) {
      running = true;
      requireActivity().invalidateOptionsMenu();
      viewModel.startGame();
    } else if (itemId == R.id.settings) {
      NavController navController = Navigation.findNavController(binding.getRoot());
      navController.navigate(GameFragmentDirections.openSettings());
    } else {
      handled = false;
    }
      return handled;

  }

  //Method indicates menu will not be visible while game is running.
  @Override
  public void onPrepareMenu(@NonNull Menu menu) {
    MenuProvider.super.onPrepareMenu(menu);
    menu.findItem(R.id.start_game).setVisible(! running);
  }

  private void handleToggle(CompoundButton target, boolean checked) {
    if (checked) {
      Arrays.stream(choices)
          .filter((choice) -> choice.isChecked() && choice != target)
          .forEach((choice) -> choice.setChecked(false));
      //noinspection unchecked
      viewModel.setGuess((Set<FizzBuzz>) target.getTag());
    } else {
      viewModel.setGuess(null);
    }
  }

  @ColorInt
  private int getColor(int attr) {
    TypedValue typedValue = new TypedValue();
    Theme theme = requireContext().getTheme();
    //put results in the typedValue passed
    theme.resolveAttribute(attr, typedValue, true);
    return typedValue.data;
  }
}