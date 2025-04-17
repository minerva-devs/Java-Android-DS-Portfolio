package edu.cnm.deepdive.farkle.controller;

import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ImageButton;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;
import androidx.lifecycle.LifecycleOwner;
import androidx.lifecycle.ViewModelProvider;
import androidx.navigation.Navigation;
import dagger.hilt.android.AndroidEntryPoint;
import edu.cnm.deepdive.farkle.R;
import edu.cnm.deepdive.farkle.adapter.PlayerAdapter;
import edu.cnm.deepdive.farkle.adapter.ScoringGroupAdapter;
import edu.cnm.deepdive.farkle.databinding.FragmentGameBinding;
import edu.cnm.deepdive.farkle.model.dto.Die;
import edu.cnm.deepdive.farkle.model.dto.Game;
import edu.cnm.deepdive.farkle.model.dto.User;
import edu.cnm.deepdive.farkle.service.ScoreMaster;
import edu.cnm.deepdive.farkle.viewmodel.GameViewModel;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import javax.inject.Inject;


/**
 * A fragment that facilitates the gameplay interface for the Farkle Game application.
 * <p>
 * GameFragment is responsible for managing the UI and interaction logic during gameplay. It ties
 * together game state and user inputs to update and process game behaviors via the GameViewModel.
 * This fragment provides options for users to roll dice, select dice groups for scoring, submit
 * choices, clear selections, or end their turn. Users can also navigate back to the home screen
 * using the provided interface.
 * <p>
 * This fragment observes data changes from the GameViewModel, such as the current game state and
 * user information, to dynamically update its UI.
 */
@AndroidEntryPoint
public class GameFragment extends Fragment {

  private static final String TAG = HomeFragment.class.getSimpleName();
  private FragmentGameBinding binding;
  private GameViewModel viewModel;
  private boolean finished = false;
  private ScoringGroupAdapter scoringGroupAdapter;
  private final List<int[]> frozenGroups = new ArrayList<>();
  private ImageButton[] diceButtons;
  private Game game;
  private User user;

  @Inject
  ScoreMaster scoreMaster;

  @Override
  public View onCreateView(
      LayoutInflater inflater,
      ViewGroup container,
      Bundle savedInstanceState) {
    binding = FragmentGameBinding.inflate(inflater, container, false);

    bindEndTurnButton();

    bindSelectGroupButton();

    bindSubmitChoice();

    bindGoHomeButton();

    bindClearButton();

    return binding.getRoot();
  }

  @Override
  public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
    super.onViewCreated(view, savedInstanceState);

    viewModel = new ViewModelProvider(requireActivity()).get(GameViewModel.class);

    getLifecycle().addObserver(viewModel);

    viewModel.startOrJoin();

    LifecycleOwner owner = getViewLifecycleOwner();
    viewModel.getGame().observe(owner, this::updateUi);

    viewModel.getUser().observe(owner, (user) -> {
      this.user = user;
    });

  }


  /**
   * Binds the "Select Group" button to its corresponding functionality. This method sets up an
   * {@code OnClickListener} for the button, allowing users to select a group of dice based on the
   * toggled dice buttons. When the button is clicked, the selected dice values from the most recent
   * roll are collected, and the selected group of dice is added to a list of frozen groups.
   * <p>
   * The method performs the following operations: - Retrieves the dice values from the current
   * roll. - Identifies dice that have been selected (toggled) by the user. - Converts the selected
   * dice to an integer array and stores it in the frozen groups list. - Resets the toggle state of
   * all dice buttons. - Displays a Snackbar message to confirm that the scoring group has been
   * added and prompts the user to either select more dice or submit their choice.
   */
  private void bindSelectGroupButton() {
    binding.selectGroupButton.setOnClickListener((v) -> {
      List<Integer> selectedDice = new ArrayList<>();
      List<Die> dice = game.getCurrentTurn().getLastRoll().getDice();
      for (int i = 0; i < diceButtons.length; i++) {
        if (diceButtons[i].getTag() != null && (Boolean) diceButtons[i].getTag()) {
          selectedDice.add(dice.get(i).getValue());
        }
      }
      int[] diceGroup = selectedDice.stream().mapToInt(Integer::intValue).toArray();
      frozenGroups.add(diceGroup);
      for (ImageButton button : diceButtons) {
        button.setTag(false); // Reset toggles.
      }
      refreshGroupsDisplay();
    });
  }

  private void refreshGroupsDisplay() {
    scoringGroupAdapter =
        new ScoringGroupAdapter(requireContext(), frozenGroups, scoreMaster);

    binding.scoringGroupsList.setAdapter(scoringGroupAdapter);
  }

  private void bindEndTurnButton() {
    binding.endTurnButton.setOnCheckedChangeListener((buttonView, isChecked) -> {
      finished = isChecked; // Update e
    });
  }

  private void bindGoHomeButton() {
    binding.quitButton.setOnClickListener(v -> {
      Navigation.findNavController(binding.getRoot()
      ).navigate(GameFragmentDirections.navigateToHomeFragment());
    });
  }

  private void bindSubmitChoice() {
    binding.submitChoiceButton.setOnClickListener((v) -> {

      viewModel.submitRollChoice(frozenGroups, finished);
      frozenGroups.clear();
      binding.diceContainer.removeAllViews();
      binding.endTurnButton.setChecked(false);
      for (ImageButton button : diceButtons) {
        button.setTag(false);
        button.getDrawable().setAlpha(255);
      }
      refreshGroupsDisplay();
    });
  }

  private void bindClearButton() {
    binding.clearButton.setOnClickListener((v) -> {
      frozenGroups.clear();
      for (ImageButton button : diceButtons) {
        button.setTag(false);
        button.getDrawable().setAlpha(255);
      }
      refreshGroupsDisplay();
    });
  }

  private void updateUi(Game game) {
    if (this.game == null
        || this.game.getState() != game.getState()
        || this.game.getPlayers().size() != game.getPlayers().size()
        || this.game.getRollCount() != game.getRollCount()) {
      this.game = game;
      PlayerAdapter adapter = new PlayerAdapter(requireContext(), game.getPlayers(),
          game.getCurrentTurn());
      binding.players.setAdapter(adapter);
      binding.diceContainer.removeAllViews();
      switch (game.getState()) {
        case PRE_GAME:
          break;
        case IN_PLAY:
          if (game.getCurrentTurn().getLastRoll() != null && game.getCurrentTurn().getUser()
              .equals(user)) {
            List<Die> dice = game.getCurrentTurn().getLastRoll().getDice();
            diceButtons = dice
                .stream()
                .map((die) -> {
                  ImageButton button = (ImageButton) getLayoutInflater().inflate(
                      R.layout.die_button,
                      binding.diceContainer, false);
                  button.getDrawable().setLevel(die.getValue());
                  button.setOnClickListener((v) -> {
                    Boolean selected = (Boolean) button.getTag();
                    if (selected == null || !selected) {
                      button.getDrawable().setAlpha(64);
                      button.setTag(true);
                    } else {
                      button.getDrawable().setAlpha(255);
                      button.setTag(false);
                    }

                  });
                  binding.diceContainer.addView(button);
                  return button;
                })
                .toArray(ImageButton[]::new);
          }
          break;
        case FINISHED:
          break;

        default:
          throw new IllegalStateException("Unexpected game state: " + game.getState());

      }
    }
  }

  @Override
  public void onDestroyView() {
    binding = null;
    super.onDestroyView();
  }

  private int[][] getFrozenGroups() {
    return frozenGroups.toArray(new int[0][0]);
  }

  private List<int[]> convertToList(int[][] array) {
    List<int[]> list = new ArrayList<>();
    Collections.addAll(list, array);
    return list;
  }


}