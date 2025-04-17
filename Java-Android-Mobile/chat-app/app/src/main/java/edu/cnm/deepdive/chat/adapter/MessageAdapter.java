package edu.cnm.deepdive.chat.adapter;

import android.content.Context;
import android.view.LayoutInflater;
import android.view.ViewGroup;
import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;
import androidx.recyclerview.widget.RecyclerView.ViewHolder;
import dagger.hilt.android.qualifiers.ActivityContext;
import dagger.hilt.android.scopes.FragmentScoped;
import edu.cnm.deepdive.chat.databinding.ItemMessageBinding;
import edu.cnm.deepdive.chat.model.dto.Message;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.format.FormatStyle;
import java.util.ArrayList;
import java.util.List;
import javax.inject.Inject;

@FragmentScoped
public class MessageAdapter extends RecyclerView.Adapter<RecyclerView.ViewHolder> {

  private final LayoutInflater inflater;
  private final List<Message> messages;
  private final DateTimeFormatter formatter;

  @Inject
  MessageAdapter(@ActivityContext Context context) {
    inflater = LayoutInflater.from(context);
    messages = new ArrayList<>();
    formatter = DateTimeFormatter.ofLocalizedDateTime(FormatStyle.MEDIUM);

  }

  //used when need to display items and there aren't sufficient holders, so more holders are created
  @NonNull
  @Override
  public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int position) {
    return new Holder(ItemMessageBinding.inflate(inflater, parent, false), formatter); //constructor with 2 params: inflate() is one, formatter is another
  }

  //cast is applied before dot operator bec dot takes priority, so the dot operator is applied to the output from the parens on the left
  @Override
  public void onBindViewHolder(@NonNull ViewHolder viewHolder, int position) {
   ((Holder) viewHolder).bind(messages.get(position));

  }

  @Override
  public int getItemCount() {
    return messages.size();
  }

  public void setMessages(@NonNull List<Message> messages) {
    int oldSize = this.messages.size();
    if (messages.isEmpty()) {
      this.messages.clear();
      notifyItemRangeRemoved(0, oldSize);
    } else {
      this.messages.addAll(messages.subList(oldSize, messages.size()));
      notifyItemRangeInserted(oldSize, messages.size() - oldSize);

    }
  }

  private static class Holder extends RecyclerView.ViewHolder {

    private final ItemMessageBinding binding;
    private final DateTimeFormatter formatter;

    Holder(ItemMessageBinding binding, DateTimeFormatter formatter) {
      super(binding.getRoot());   //will return cardview
      this.binding = binding;
      this.formatter = formatter;
    }


  //this puts the text of the message of the sender  AND gets time msg was posted
    //left side of the dot is the object/class, right side of dot is the field/item inside that class
    //ie in binding class, there's a field named sender
    void bind(Message message) {
      binding.sender.setText(message.getSender().getDisplayName());
      binding.posted.setText(message.getPosted().atZone(ZoneId.systemDefault()).format(formatter));
      binding.text.setText(message.getText());
    }
  }

}
