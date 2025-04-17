package edu.cnm.deepdive.farkle.adapter;

import android.content.Context;
import android.content.res.Resources.Theme;
import android.util.TypedValue;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ArrayAdapter;
import androidx.annotation.ColorInt;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import edu.cnm.deepdive.farkle.R;
import edu.cnm.deepdive.farkle.databinding.ItemPlayerBinding;
import edu.cnm.deepdive.farkle.model.dto.GamePlayer;
import edu.cnm.deepdive.farkle.model.dto.Turn;
import java.util.List;

public class PlayerAdapter extends ArrayAdapter<GamePlayer> {

  private final LayoutInflater inflater;
  private final Turn currentTurn;
  @ColorInt
  private final int accentColor;
  @ColorInt
  private final int surfaceColor;
  @ColorInt
  private final int colorOnAccent;
  @ColorInt
  private final int colorOnSurface;

  public PlayerAdapter(@NonNull Context context,
      @NonNull List<GamePlayer> players, Turn currentTurn) {
    super(context, R.layout.item_player, players);
    inflater = LayoutInflater.from(context);
    this.currentTurn = currentTurn;
    accentColor = getThemeColor(com.google.android.material.R.attr.colorAccent, context);
    surfaceColor = getThemeColor(com.google.android.material.R.attr.colorSurface, context);
    colorOnAccent = getThemeColor(com.google.android.material.R.attr.colorOnPrimary, context);
    colorOnSurface = getThemeColor(com.google.android.material.R.attr.colorOnSurface, context);
  }


  @NonNull
  @Override
  public View getView(int position, @Nullable View convertView, @NonNull ViewGroup parent) {
    ItemPlayerBinding binding = (convertView == null)
        ? ItemPlayerBinding.inflate(inflater, parent, false)
        : ItemPlayerBinding.bind(convertView);

    GamePlayer player = getItem(position);
    if (currentTurn != null && currentTurn.getUser().equals(player.getUser())) {

      binding.getRoot().setBackgroundColor(accentColor);
      binding.displayName.setTextColor(colorOnAccent);
    } else {
      binding.getRoot().setBackgroundColor(surfaceColor);
      binding.displayName.setTextColor(colorOnSurface);
    }
    binding.displayName.setText(player.getUser().getDisplayName());
    binding.score.setText(String.valueOf(player.getScore()));
    return binding.getRoot();
  }

  private int getThemeColor(int attrId, Context context) {
    TypedValue typedValue = new TypedValue();
    Theme theme = context.getTheme();
    theme.resolveAttribute(attrId, typedValue, true);
    return typedValue.data;
  }
}


