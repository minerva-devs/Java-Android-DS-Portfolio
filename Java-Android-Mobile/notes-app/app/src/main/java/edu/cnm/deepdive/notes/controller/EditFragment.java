package edu.cnm.deepdive.notes.controller;

import android.Manifest.permission;
import android.app.Dialog;
import android.content.Context;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.util.TypedValue;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.ColorInt;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;
import androidx.lifecycle.LifecycleOwner;
import androidx.lifecycle.ViewModelProvider;
import com.google.android.material.bottomsheet.BottomSheetDialogFragment;
import dagger.hilt.android.AndroidEntryPoint;
import edu.cnm.deepdive.notes.R;
import edu.cnm.deepdive.notes.databinding.FragmentEditBinding;
import edu.cnm.deepdive.notes.model.entity.Note;
import edu.cnm.deepdive.notes.service.ImageFileProvider;
import edu.cnm.deepdive.notes.viewmodel.NoteViewModel;
import java.io.File;
import java.util.UUID;

//This EditFragment is a bottom sheet dialog that allows users to view & edit a note in a
// note-taking app. It connects to a NoteViewModel, listens for updates to a Note, and
// updates the UI dynamically.

@AndroidEntryPoint
public class EditFragment extends BottomSheetDialogFragment {

  private static final String TAG = EditFragment.class.getSimpleName();
  private static final String AUTHORITY = ImageFileProvider.class.getName().toLowerCase();

  private FragmentEditBinding binding;
  private NoteViewModel viewModel;
  private long noteId;
  private Note note;
  private ActivityResultLauncher<Uri> captureLauncher;
  private Uri uri;

//  @ColorInt
//  private int cancelColor;
//  @ColorInt
//  private int saveColor;
// DONE cancelColor = getThemeColor(R.attr.colorCancel);
//    saveColor= getThemeColor(R.attr.colorSave);

  @Override
  public void onCreate(@Nullable Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    noteId = EditFragmentArgs.fromBundle(getArguments()).getNoteId();
  }

  //THIS IS WHERE MOST OF THE WORK OCCURS
  @NonNull
  @Override
  public Dialog onCreateDialog(@Nullable Bundle savedInstanceState) {
    // TODO: 2025-02-18 Inflate layout and construct & return dialog containing layout.
    return super.onCreateDialog(savedInstanceState);
  }

  // this code sets up the layout for a fragment by inflating a layout resource using data
  // binding and returning the root view of the inflated layout. The layout will be used
  // to display the fragment's user interface.
  //This is being invoked by inherited activity by the lifecycles of the fragments being hosted by the activity
  @Nullable
  @Override
  public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container,
      @Nullable Bundle savedInstanceState) {
    binding = FragmentEditBinding.inflate(inflater, container, false);
    // DONE: 2025-02-18 Attach listeners to UI widgets.
    binding.cancel.setOnClickListener((v) -> dismiss());
    binding.save.setOnClickListener((v) -> save());
    binding.capture.setOnClickListener((v) -> capture());
    setCaptureVisibility();
    return binding.getRoot();
  }
// DONE: 2/18/25 Return root element of layout.

//This fragment listens for changes in the NoteViewModel.
  //When a Note is updated, it dynamically updates the UI.
  //It ensures that UI elements only display when necessary (e.g., hiding the image if none exists).
@Override
public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
  super.onViewCreated(view, savedInstanceState);
  viewModel = new ViewModelProvider(requireActivity()).get(NoteViewModel.class);
  LifecycleOwner owner = getViewLifecycleOwner();
  if (noteId != 0) {
    viewModel.fetch(noteId);
    viewModel
        .getNote()
        .observe(owner, this::handleNote);
  } else {
    // TODO: 2025-02-18 Configure UI for a new note, vs. editing an existing note.
    // DONE: 2/18/25 Connect to viewmodel(s) and observe LiveData.
    binding.image.setVisibility(View.GONE);
    note = new Note();
    uri = null;
    viewModel.clearCaptureUri();
  }
 viewModel
     .getCaptureUri()
     .observe(owner, this::handleCaptureUri);
  //passing the result directly to viewModel
  captureLauncher = registerForActivityResult(
      new ActivityResultContracts.TakePicture(), viewModel::confirmCapture);
}

  @Override
  public void onDestroyView() {
    binding = null;
    super.onDestroyView();
  }

  //helper method
  private void handleCaptureUri(Uri uri) {
    if (uri != null) {
      this.uri = uri;
//here we tell it to put the image in the widget
      binding.image.setImageURI(uri);
      binding.image.setVisibility(View.VISIBLE);
    }
  }

  private void setCaptureVisibility() {
    if (ContextCompat.checkSelfPermission(requireContext(), permission.CAMERA) ==
        PackageManager.PERMISSION_GRANTED) {
//If I have permission, then I'll make the camera icon image visible.
      binding.capture.setVisibility(View.VISIBLE);
    } else {
//If I don't have permission, then camera icon image will not be visible.
      binding.capture.setVisibility(View.GONE);
    }
  }

  private void handleNote(Note note) {
    this.note = note;
    binding.title.setText(note.getTitle());
    binding.content.setText(note.getContent());
    Uri imageUri = note.getImage();
    if (imageUri != null) {
      binding.image.setImageURI(imageUri);
      binding.image.setVisibility(View.VISIBLE);
    } else {
      binding.image.setVisibility(View.GONE);
    }
    uri = imageUri;
  }

  /**
   * @noinspection DataFlowIssue
   */
  private void save() {
    note.setTitle(binding.title
        .getText()
        .toString() //suppressed for method
        .strip());
    note.setContent(binding.content
        .getText()
        .toString() //suppressed for method
        .strip());
    note.setImage(uri);
    // TODO: 2025-02-18 Set/modify the createdOn/modifiedOn
    viewModel.save(note);
    dismiss();
  }

  @ColorInt
  private int getThemeColor(int colorAttr) {
    TypedValue typedValue = new TypedValue();  //container to read an attribute
    requireContext().getTheme().resolveAttribute(colorAttr, typedValue,
        true); //this is how we look up the value of an attribute.
    return typedValue.data;
  }

    //This is what we need to execute when the user clicks on capture//
    /** @noinspection ResultOfMethodCallIgnored*/
    private void capture() {
      // DONE: 2/24/25 Using the context, get a reference to the directory where we store captured images.
      //A File here is not a file but an object that references to a directory. It returns a File object. The capture_directory is an int identifier.
      Context context = requireContext();
      File captureDir = new File(context.getFilesDir(), getString(R.string.capture_directory));
      // DONE: 2/24/25 Ensure that the directory exists.
      //noinspection ResultofMethodCallIgnored (suppressed for method)
      captureDir.mkdir();
      // DONE: 2/24/25 Generate a random file name for the captured image.
      File captureFile;
      // DONE: 2/24/25 Get a URI for the random file, using the provider infrastructure.
      do {
        captureFile = new File(captureDir, UUID.randomUUID().toString());  //inside constructor, relative to the file directory
      } while (captureFile.exists());
      Uri uri = FileProvider.getUriForFile(context, AUTHORITY, captureFile);
      // DONE: 2025-02-24 Store the URI in the viewmodel.
      viewModel.setPendingCaptureUri(uri);
      // DONE: 2025-02-24 Launch the capture launcher.
      captureLauncher.launch(uri);
    }

    //requireContext() method is used twice to access files, DRY violation. Gives visibility to find providers, extracted as variable as context


}