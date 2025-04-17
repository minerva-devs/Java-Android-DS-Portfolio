package edu.cnm.deepdive.spaceseek.adapter;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;
import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;
import edu.cnm.deepdive.spaceseek.R;
import java.util.List;

public class FavoritesAdapter extends RecyclerView.Adapter<FavoritesAdapter.ViewHolder> {

  private final List<String> favorites;

  public FavoritesAdapter(List<String> favorites) {
    this.favorites = favorites;
  }

  @NonNull
  @Override
  public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
    View view = LayoutInflater.from(parent.getContext())
        .inflate(R.layout.item_favorite, parent, false);
    return new ViewHolder(view);
  }

  @Override
  public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
    holder.favoriteTitle.setText(favorites.get(position));
  }

  @Override
  public int getItemCount() {
    return favorites.size();
  }

  static class ViewHolder extends RecyclerView.ViewHolder {
    private final TextView favoriteTitle;

    public ViewHolder(@NonNull View itemView) {
      super(itemView);
      favoriteTitle = itemView.findViewById(R.id.favorite_title);
    }
  }
}