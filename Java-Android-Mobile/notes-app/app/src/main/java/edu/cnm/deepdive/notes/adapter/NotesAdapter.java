package edu.cnm.deepdive.notes.adapter;

import android.content.Context;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView.Adapter;
import androidx.recyclerview.widget.RecyclerView.ViewHolder;
import edu.cnm.deepdive.notes.databinding.ItemNoteBinding;
import edu.cnm.deepdive.notes.model.entity.Note;
import java.util.List;

public class NotesAdapter extends Adapter<ViewHolder> {

  private final LayoutInflater inflater;
  private final List<Note> notes;
  private final OnLongClickListener listener;

  public NotesAdapter(
      @NonNull Context context, @NonNull List<Note> notes, @NonNull OnLongClickListener listener) {
    this.notes = notes;
    inflater = LayoutInflater.from(context);
    this.listener = listener;
  }

  //WHEN THIS method gets invoked the viewGroup is passed, inflater checks viewGroup for themes
  @NonNull
  @Override
  public ViewHolder onCreateViewHolder(@NonNull ViewGroup viewGroup, int viewType) {
    ItemNoteBinding binding = ItemNoteBinding.inflate(inflater, viewGroup, false);
    return new Holder(binding, listener);
  }
  //and pass that binding we just attached to it // DONE: 2025-02-13 Create and return an instance of Holder.
  //this is the layout for a single item, so when we create our holder we're passing the

  @Override
  public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
    ((Holder) holder).bind(position, notes.get(position));
    // TODO: 2025-02-13 Invoke holder.bind with the object in position i.
    //cast holder to use as an instance from Holder class in another class by placing it in parentheses
  }

  @Override
  public int getItemCount() {
    return notes.size(); // DONE: 2025-02-13 Return the number of Note instances that can be displayed in this view.
  }//here, the adapter tells RecyclerView how many items on the list- in this case items are the notes created-

  private static class Holder extends ViewHolder {

    private ItemNoteBinding binding;  //hold the text here which we'll use at a later field, we'll put the text into display
    private final OnLongClickListener listener;

    public Holder(@NonNull ItemNoteBinding binding, @NonNull OnLongClickListener listener) { //we'll keep reusing the holder, it has reference
      // to all our widgets and fields, which means we'll reuse the binding that we're using to put text into display
      super(binding.getRoot());
      this.binding = binding;
      // TODO: 2025-02-13 Initialize any fields.
      this.listener = listener;
    }

    public void bind(int position, Note note) {
      binding.title.setText(note.getTitle());  //the field is title on which we'll invoke
      binding.modifiedOn.setText(note.getModifiedOn().toString());
      binding.getRoot().setOnLongClickListener(view -> listener.onLongClick(view, note, position)); // TODO: 2/17/25 Invoke listener provided by UI controller.
      }

  }

  @FunctionalInterface
  public interface OnLongClickListener {

    boolean onLongClick(View view, Note note, int position);

  }

}


//
// TODO: 2025-02-13 Use data from item to populate widgets in itemView.
//purpose of binding process is to bind model objects to widgets

//getItemCount tells RecyclerView how many items on the list: in this case items are the notes created.
// ViewHolder
//RecyclerView is a container as it holds items, so it is a parent
//will create holders depending on the space it has to invoke our code to display items
//we only need the view machinery depending on how many items
//OnCreateViewHolder is only to create a new holder ie on reddit going from a large post/page, to a smaller
// sub with minimal photos. Now more space is freed because there were holders created for the many in first
// page vs the few holders for the 2nd page.
//model and note dont have visual representation
//job of the adapter is to provide view widgets to a container/scrollling container, and widgets are based on model class instances