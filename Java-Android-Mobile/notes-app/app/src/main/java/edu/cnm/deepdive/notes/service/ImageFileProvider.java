package edu.cnm.deepdive.notes.service;

import androidx.core.content.FileProvider;
import edu.cnm.deepdive.notes.R;

public class ImageFileProvider extends FileProvider {

  public ImageFileProvider() {
    super(R.xml.provider_paths);
    // TODO: 2/24/25 Initialize with our provider-path mapping
  }
}
