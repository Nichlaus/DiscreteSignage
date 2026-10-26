package com.discretesignage.display;

import android.animation.ValueAnimator;
import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Path;
import android.view.View;

final class CatPreviewView extends View {
    private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Path ears = new Path();
    private float gazeX, gazeY, pawAngle;
    private ValueAnimator wave;
    CatPreviewView(Context context) { super(context); setContentDescription("Friendly orange cat"); }
    void look(float x, float y) { gazeX = Math.max(-1, Math.min(1, x)) * 5; gazeY = Math.max(-1, Math.min(1, y)) * 4; invalidate(); }
    void wave() {
        resetWave();
        if (!ValueAnimator.areAnimatorsEnabled()) return;
        wave = ValueAnimator.ofFloat(0, 35); wave.setDuration(300);
        wave.setRepeatCount(5); wave.setRepeatMode(ValueAnimator.REVERSE);
        wave.addUpdateListener(value -> { pawAngle = (float) value.getAnimatedValue(); invalidate(); });
        wave.start();
    }
    private void resetWave() { if (wave != null) { wave.cancel(); wave = null; } pawAngle = 0; }
    void reset() { resetWave(); gazeX = 0; gazeY = 0; invalidate(); }
    private void oval(Canvas c, int color, float left, float top, float right, float bottom) {
        paint.setColor(color); c.drawOval(left, top, right, bottom, paint);
    }
    @Override protected void onDraw(Canvas canvas) {
        super.onDraw(canvas); canvas.save();
        float scale = Math.min(getWidth()/240f, getHeight()/250f);
        canvas.translate((getWidth()-240*scale)/2, (getHeight()-250*scale)/2); canvas.scale(scale, scale);
        oval(canvas, 0xffe8a365, 65, 155, 178, 241);
        paint.setColor(0xffe8a365); ears.reset();
        ears.moveTo(55, 105); ears.lineTo(53, 35); ears.lineTo(105, 70); ears.close();
        ears.moveTo(140, 70); ears.lineTo(189, 35); ears.lineTo(186, 110); ears.close(); canvas.drawPath(ears, paint);
        oval(canvas, 0xffedb279, 52, 60, 192, 181);
        oval(canvas, 0xff253c39, 84+gazeX, 105+gazeY, 100+gazeX, 128+gazeY);
        oval(canvas, 0xff253c39, 144+gazeX, 105+gazeY, 160+gazeX, 128+gazeY);
        oval(canvas, 0xff875952, 115, 136, 129, 146);
        oval(canvas, 0xfff8d4a8, 70, 225, 116, 245); oval(canvas, 0xfff8d4a8, 126, 225, 172, 245);
        canvas.save(); canvas.rotate(pawAngle, 77, 200);
        oval(canvas, 0xffe8a365, 33, 162, 82, 210); oval(canvas, 0xfff8d4a8, 30, 147, 57, 180);
        canvas.restore(); canvas.restore();
    }
    @Override protected void onDetachedFromWindow() { reset(); super.onDetachedFromWindow(); }
}
