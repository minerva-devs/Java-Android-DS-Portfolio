package edu.cnm.deepdive.notes.controller;

import android.app.AlertDialog;
import android.app.Dialog;
import android.os.Bundle;
import android.view.View.OnClickListener;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.DialogFragment;
import edu.cnm.deepdive.notes.R;

public class ExplanationFragment extends DialogFragment {

  @NonNull
  @Override
  //the value of this expression is Builder, on that builder we invoke setTitle,
  // and on that builder we invoke setIcon, etc
  public Dialog onCreateDialog(@Nullable Bundle savedInstanceState) {
    return new AlertDialog.Builder(requireContext())
        .setTitle(R.string.camera_permission_title)
        .setIcon(android.R.drawable.ic_dialog_info)
        .setMessage(R.string.camera_permission_explanation)
        .setNeutralButton(android.R.string.ok, (dialog, which) ->
            // TODO: 2/19/25 Tell activity we're done.
            ((OnDismissListener) requireActivity()).onDismiss())
                .create();
  }

  public interface OnDismissListener {
    void onDismiss();
  }
}


