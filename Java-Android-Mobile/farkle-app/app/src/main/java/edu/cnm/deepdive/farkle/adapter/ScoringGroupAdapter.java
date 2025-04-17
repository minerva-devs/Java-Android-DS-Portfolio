package edu.cnm.deepdive.farkle.adapter;

import android.content.Context;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ArrayAdapter;
import android.widget.ImageView;
import edu.cnm.deepdive.farkle.R;
import edu.cnm.deepdive.farkle.databinding.ItemScoringGroupBinding;
import edu.cnm.deepdive.farkle.service.ScoreMaster;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

public class ScoringGroupAdapter extends ArrayAdapter<int[]> {

  private final LayoutInflater inflater;
  private final ScoreMaster scoreMaster;

  public ScoringGroupAdapter(Context context, List<int[]> scoringGroups, ScoreMaster scoreMaster) {
    super(context, R.layout.item_scoring_group, scoringGroups);

    this.inflater = LayoutInflater.from(context);
    this.scoreMaster = scoreMaster;
  }

  @Override
  public View getView(int position, View convertView, ViewGroup parent) {
    ItemScoringGroupBinding binding = (convertView == null)
        ? ItemScoringGroupBinding.inflate(inflater, parent, false)
        : ItemScoringGroupBinding.bind(convertView);
    int[] dice = getItem(position);
    Arrays.stream(dice)
        .forEach((value) -> {
          ImageView dieImage = (ImageView) inflater.inflate(R.layout.item_group_die,
              binding.diceContainer, false);
          dieImage.getDrawable().setLevel(value);
          binding.diceContainer.addView(dieImage);
        });
    int score = scoreMaster.getScore(
        Arrays.stream(dice).sorted().boxed().collect(Collectors.toList()));
    binding.score.setText(String.valueOf(score));
    // TODO: 4/9/2025 look up dice combination in scoring table and use binding.score.setValue() *must be a string*
    return binding.getRoot();
  }

}

