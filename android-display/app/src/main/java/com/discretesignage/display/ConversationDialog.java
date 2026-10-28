package com.discretesignage.display;

import android.app.Activity;
import android.os.Handler;
import android.os.Looper;
import android.text.InputFilter;
import android.view.View;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;
import androidx.appcompat.app.AlertDialog;
import com.google.android.gms.tasks.Task;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;

/** Short-lived customer text session; no transcript is saved on the device. */
final class ConversationDialog {
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Function<Map<String, Object>, Task<Object>> send;
    private final List<Map<String, String>> history = new ArrayList<>();
    private AlertDialog dialog;
    private int epoch;
    private final Runnable expire = this::close;

    ConversationDialog(Function<Map<String, Object>, Task<Object>> send) { this.send = send; }

    void open(Activity activity) {
        if (dialog != null) return;
        int ticket = ++epoch;
        LinearLayout form = new LinearLayout(activity); form.setOrientation(LinearLayout.VERTICAL);
        int padding = (int)(20 * activity.getResources().getDisplayMetrics().density);
        form.setPadding(padding, padding, padding, padding);
        TextView notice = new TextView(activity);
        notice.setText("Your question, recent messages and approved product details are sent to OpenAI. Do not enter personal information. AI answers can be wrong; ask staff about important details.");
        form.addView(notice);
        TextView result = new TextView(activity); result.setText("Ask about our featured products."); form.addView(result);
        EditText question = new EditText(activity); question.setHint("Your question");
        question.setSingleLine(false); question.setMaxLines(3); question.setFilters(new InputFilter[]{new InputFilter.LengthFilter(300)});
        question.setImeOptions(question.getImeOptions() | android.view.inputmethod.EditorInfo.IME_FLAG_NO_PERSONALIZED_LEARNING);
        question.setSaveEnabled(false); question.setImportantForAutofill(View.IMPORTANT_FOR_AUTOFILL_NO);
        question.addTextChangedListener(new android.text.TextWatcher() {
            public void beforeTextChanged(CharSequence s, int start, int count, int after) { }
            public void onTextChanged(CharSequence s, int start, int before, int count) { handler.removeCallbacks(expire); handler.postDelayed(expire, 60000); }
            public void afterTextChanged(android.text.Editable s) { }
        });
        form.addView(question);
        dialog = new AlertDialog.Builder(activity).setTitle("Ask about our products")
                .setView(form).setPositiveButton("Ask", null).setNegativeButton("End conversation", (d, w) -> {}).create();
        dialog.setOnDismissListener(d -> { epoch++; history.clear(); dialog = null; question.setText(""); handler.removeCallbacks(expire); });
        dialog.show();
        dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v -> {
            String message = question.getText().toString().trim();
            if (message.isEmpty()) { question.setError("Enter a question."); return; }
            handler.removeCallbacks(expire); handler.postDelayed(expire, 60000);
            Map<String, Object> payload = new HashMap<>(); payload.put("message", message); payload.put("history", new ArrayList<>(history));
            dialog.getButton(AlertDialog.BUTTON_POSITIVE).setEnabled(false); result.setText("Thinking…");
            final Task<Object> pending;
            try { pending = send.apply(payload); }
            catch (RuntimeException error) {
                dialog.getButton(AlertDialog.BUTTON_POSITIVE).setEnabled(true);
                result.setText("Sorry, I can't answer right now. Please ask a staff member."); return;
            }
            pending.addOnCompleteListener(task -> {
                if (ticket != epoch || dialog == null) return;
                dialog.getButton(AlertDialog.BUTTON_POSITIVE).setEnabled(true);
                Object value = task.isSuccessful() && task.getResult() instanceof Map ? ((Map<?, ?>)task.getResult()).get("answer") : null;
                if (!(value instanceof String) || ((String)value).isEmpty() || ((String)value).length() > 500) {
                    result.setText("Sorry, I can't answer right now. Please ask a staff member."); return;
                }
                while (history.size() >= 6) { history.remove(0); history.remove(0); }
                history.add(Map.of("role", "user", "text", message)); history.add(Map.of("role", "assistant", "text", (String)value));
                question.setText(""); result.setText((String)value);
            });
        });
        handler.postDelayed(expire, 60000);
    }
    void close() { if (dialog != null) dialog.dismiss(); }
}
