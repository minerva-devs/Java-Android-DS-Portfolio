package edu.cnm.deepdive.spaceseek.utils;

import android.content.Context;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

public class RecyclerViewUtils {

  public static void setupRecyclerView(Context context, RecyclerView recyclerView, RecyclerView.Adapter<?> adapter) {
    recyclerView.setLayoutManager(new LinearLayoutManager(context));
    recyclerView.setAdapter(adapter);
  }
}