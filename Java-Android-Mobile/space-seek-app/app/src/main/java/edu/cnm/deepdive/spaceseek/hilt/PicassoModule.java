package edu.cnm.deepdive.spaceseek.hilt;

import android.content.Context;
import com.squareup.picasso.Picasso;
import dagger.Module;
import dagger.Provides;
import dagger.hilt.InstallIn;
import dagger.hilt.android.components.FragmentComponent;
import dagger.hilt.android.qualifiers.ApplicationContext;
import dagger.hilt.android.scopes.FragmentScoped;

@Module
@InstallIn(FragmentComponent.class)
public class PicassoModule {

  @Provides
  @FragmentScoped
  Picasso providePicasso(@ApplicationContext Context context) {
    return new Picasso.Builder(context)
        .build();
  }

}
