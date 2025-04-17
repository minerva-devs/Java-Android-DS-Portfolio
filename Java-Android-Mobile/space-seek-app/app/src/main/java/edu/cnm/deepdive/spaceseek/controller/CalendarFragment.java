package edu.cnm.deepdive.spaceseek.controller;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;
import androidx.lifecycle.LifecycleOwner;
import androidx.lifecycle.ViewModelProvider;
import androidx.navigation.Navigation;
import com.kizitonwose.calendar.core.CalendarMonth;
import dagger.hilt.android.AndroidEntryPoint;
import edu.cnm.deepdive.spaceseek.NavGraphDirections;
import edu.cnm.deepdive.spaceseek.R;
import edu.cnm.deepdive.spaceseek.adapter.DayBinder;
import edu.cnm.deepdive.spaceseek.adapter.HeaderBinder;
import edu.cnm.deepdive.spaceseek.databinding.FragmentCalendarBinding;
import edu.cnm.deepdive.spaceseek.model.entity.Apod;
import edu.cnm.deepdive.spaceseek.model.entity.Apod.MediaType;
import edu.cnm.deepdive.spaceseek.viewmodel.ApodViewModel;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.temporal.WeekFields;
import java.util.Locale;
import java.util.Map;
import javax.inject.Inject;
import kotlin.Unit;

@AndroidEntryPoint
public class CalendarFragment extends Fragment {

  @Inject
  DayBinder dayBinder;
  @Inject
  HeaderBinder headerBinder;

  private FragmentCalendarBinding binding;
  private ApodViewModel viewModel;
  private YearMonth selectedMonth;

  @Nullable
  @Override
  public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container,
      @Nullable Bundle savedInstanceState) {
    binding = FragmentCalendarBinding.inflate(inflater, container, false);
    setupCalendar();
    return binding.getRoot();
  }

  @Override
  public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
    super.onViewCreated(view, savedInstanceState);
    LifecycleOwner owner = getViewLifecycleOwner();
    viewModel = new ViewModelProvider(requireActivity()).get(ApodViewModel.class);
    viewModel
        .getApodMap()
        .observe(owner, this::handleApods);
    viewModel
        .getYearMonth()
        .observe(owner, this::handleYearMonth);
  }

  @Override
  public void onDestroyView() {
    binding = null;
    super.onDestroyView();
  }

  private void setupCalendar() {
    LocalDate firstApodDate = LocalDate.parse(getString(R.string.first_apod_date));
    YearMonth firstApodMonth = YearMonth.from(firstApodDate);
    DayOfWeek firstDayOfWeek = WeekFields.of(Locale.getDefault())
        .getFirstDayOfWeek();
    YearMonth currentMonth = YearMonth.now();
    LocalDate today = LocalDate.now();

    binding.calendarView.setup(currentMonth.minusMonths(6), currentMonth.plusMonths(6),
        today.getDayOfWeek());
    binding.calendarView.scrollToMonth(currentMonth);
    dayBinder.setListener(this::showApod);

    binding.calendarView.setDayBinder(dayBinder);

    binding.calendarView.setMonthHeaderBinder(headerBinder);
    binding.calendarView.setup(firstApodMonth, currentMonth, firstDayOfWeek);
    binding.calendarView.setMonthScrollListener(this::handleMonthScroll);
  }

  @NonNull
  private Unit handleMonthScroll(CalendarMonth calendarMonth) {
    viewModel.setYearMonth(calendarMonth.getYearMonth());
    return Unit.INSTANCE;
  }

  private void handleYearMonth(YearMonth yearMonth) {
    if (!yearMonth.equals(selectedMonth)) {
      binding.calendarView.scrollToMonth(yearMonth);
      selectedMonth = yearMonth;
    }
  }

  private void showApod(Apod apod) {
    if (apod.getMediaType() == MediaType.IMAGE) {
      viewModel.setApodId(apod.getId());
      Navigation.findNavController(binding.getRoot())
          .navigate(NavGraphDirections.navigateToImageFragment(apod.getId()));
    } else {
      Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(apod.getLowDefUrl().toString()));
      startActivity(intent);
    }

  }

  private void handleApods(Map<LocalDate, Apod> apodMap) {
    Map<LocalDate, Apod> binderMap = dayBinder.getApodMap();
    binderMap.clear();
    binderMap.putAll(apodMap);
    apodMap
        .keySet()
        .stream()
        .map(YearMonth::from)
        .distinct()
        .forEach(binding.calendarView::notifyMonthChanged);
  }

}