package edu.cnm.deepdive.chat.viewmodel;

import android.util.Log;
import androidx.lifecycle.DefaultLifecycleObserver;
import androidx.lifecycle.LifecycleOwner;
import androidx.lifecycle.LiveData;
import androidx.lifecycle.MutableLiveData;
import androidx.lifecycle.ViewModel;
import dagger.hilt.android.lifecycle.HiltViewModel;
import edu.cnm.deepdive.chat.model.dto.Channel;
import edu.cnm.deepdive.chat.model.dto.Message;
import edu.cnm.deepdive.chat.service.MessageService;
import io.reactivex.rxjava3.disposables.CompositeDisposable;
import io.reactivex.rxjava3.disposables.Disposable;
import java.time.Instant;
import java.util.LinkedList;
import java.util.List;
import java.util.Objects;
import javax.inject.Inject;
import org.jetbrains.annotations.NotNull;
import org.jetbrains.annotations.Nullable;

/**
 * @noinspection SequencedCollectionMethodCanBeUsed
 */
@HiltViewModel
public class MessageViewModel extends ViewModel implements DefaultLifecycleObserver {

  private static final String TAG = MessageViewModel.class.getSimpleName();

  //FIRST create fields to: reference to message service, to get all messages for a particular channel
//as we make asynchronous requests and UI has received messages, then empty the jobs requests bucket
  private final MessageService messageService;
  private final MutableLiveData<List<Message>> messages;
  private final MutableLiveData<List<Channel>> channels;
  private final MutableLiveData<Channel> selectedChannel;
  private final MutableLiveData<Throwable> throwable;
  private final CompositeDisposable pending;

  private Disposable poll;

  //messageService will be the only thing Hilt will take in from the outside with this constructor
  @Inject
  public MessageViewModel(MessageService messageService) {
    this.messageService = messageService;
    messages = new MutableLiveData<>(new LinkedList<>());
    channels = new MutableLiveData<>();
    selectedChannel = new MutableLiveData<>();
    throwable = new MutableLiveData<>();
    pending = new CompositeDisposable();
    fetchChannels();
  }

  //getters for variables with LiveData, remove Mutable because we want the UI to observe and not have
// access to changing the LiveData
  public LiveData<List<Channel>> getChannels() {
    return channels;
  }

  public LiveData<List<Message>> getMessages() {
    return messages;
  }

  public LiveData<Channel> getSelectedChannel() {
    return selectedChannel;
  }

  //method UI can call to select LiveData, when we get new channel- if it's different from the one
  // being passed in (Channel channel), we clear our messages and write a new query
  //look at dto>channel ** can be nullable bec channel can be null per fetchChannels
  public void setSelectedChannel(@Nullable Channel channel) {
    if (!Objects.equals(channel, selectedChannel.getValue())) {
      messages.postValue(new LinkedList<>());
      selectedChannel.postValue(channel);
      List<Message> msgs = messages.getValue();
      // non-null per the MessageViewModel passing LinkedList above
      //noinspection DataFlowIssue
      msgs.clear();
      fetchMessages(channel, getSince(msgs));
    }
  }

  public LiveData<Throwable> getThrowable() {
    return throwable;
  }

  //the UI should be able to  fetch a channel, fetch a message, change a channel, post a channel, add a message to a channel
//if compares current to previous channel, so if this is not empty, and the channel I selected is available,
// return/use that channel, if previously selected is null, return new channel
  public void fetchChannels() {
    throwable.setValue(null);
    messageService
        .getChannels(true)
        .subscribe(
            this::handleChannels,
            this::postThrowable,
            pending
        );
  }

  //Ternary, if the list is empty, fetch since the last time they were fetched(?), else get the last posted (:)
  //Instant.MIN= the last 30 minutes per messageService in server side- getEffectiveSince(MAX= 30 MIN)

  public void fetchMessages(Channel selectedChannel, Instant since) {
    if (selectedChannel != null) {
      throwable.postValue(null);
      //cancels previous long polling process
      if (poll != null) {
        poll.dispose();
      }
      //this gets a piece of machinery<first 4 parts on board diagram of async process>
      //subscribe - provides consumer of a successful result, of an unsuccessful result & pending
      poll = messageService
          .getMessages(selectedChannel.getKey(), since)
          .subscribe(
              (msgs) -> {
                List<Message> messages = this.messages.getValue();
                if (!msgs.isEmpty()) {
                  messages.addAll(msgs);
                  fetchMessages(selectedChannel, getSince(
                      msgs));   //successful result consumer that is called at other points and times, not here, not recursive, or create time stamp otherwise
                } else {
                  fetchMessages(selectedChannel, since);
                }
                this.messages.postValue(messages);
              },
              this::postThrowable, //unsuccessful result consumer - composite disposable
              pending
          );
    }
  }

  //when we subscribe to a completable we don't have a consumer
  //then put ticket in pending bucket
  //list of a bunch of machines in a row, then ignoreElement turns it into a completion event

  /**
   * @noinspection DataFlowIssue
   */
  public void sendMessage(Message message) {
    throwable.setValue(null);
    Instant since = getSince(messages.getValue());
    messageService
        .sendMessage(selectedChannel.getValue().getKey(), message, since)
        .ignoreElement()
        .subscribe(
            () -> {
            },
            this::postThrowable,
            pending
        );
  }

  @Override
  public void onResume(@NotNull LifecycleOwner owner) {
    DefaultLifecycleObserver.super.onResume(owner);
    Channel channel = selectedChannel.getValue();
    if (channel != null) {
      List<Message> messages = this.messages.getValue();
      this.messages.postValue(messages);
      //noinspection DataFlowIssue
      fetchMessages(channel, getSince(messages));
    }
  }

  //adding a lifecycle observer in the UI model of a UI controller if we have an is-a relationship
//we're clearing container contents BUT NOT deleting container, we will use container for new content
  @Override
  public void onStop(@NotNull LifecycleOwner owner) {
    pending.clear();
    DefaultLifecycleObserver.super.onStop(owner);
  }

  private void handleChannels(List<Channel> channels) {
    this.channels.postValue(channels);
    Channel previous = this.selectedChannel.getValue();
    if (!channels.isEmpty()) {
      if (previous == null || !channels.contains(previous)) {
        setSelectedChannel(channels.get(0));
      }
    } else {
      setSelectedChannel(null);
    }
  }

  private static Instant getSince(List<Message> messages) {
    return messages.isEmpty()
        ? Instant.MIN
        : messages
            .get(messages.size() - 1)
            .getPosted();
  }

  //throwable is the parameter, this.throwable is the value of the field which the parameter refers to
  private void postThrowable(Throwable throwable) {
    Log.e(TAG, throwable.getMessage(), throwable);
    this.throwable.postValue(throwable);
  }


}
