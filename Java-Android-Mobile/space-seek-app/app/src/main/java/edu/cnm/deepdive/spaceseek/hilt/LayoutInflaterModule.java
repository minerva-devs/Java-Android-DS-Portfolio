package edu.cnm.deepdive.spaceseek.hilt;

import android.content.Context;
import android.view.LayoutInflater;
import dagger.Module;
import dagger.Provides;
import dagger.hilt.InstallIn;
import dagger.hilt.android.components.FragmentComponent;
import dagger.hilt.android.qualifiers.ActivityContext;
import dagger.hilt.android.scopes.FragmentScoped;

@Module
@InstallIn(FragmentComponent.class)
public class LayoutInflaterModule {

  @Provides
  @FragmentScoped
  LayoutInflater provideLayoutInflater(@ActivityContext Context context) {
    return LayoutInflater.from(context);
  }

}