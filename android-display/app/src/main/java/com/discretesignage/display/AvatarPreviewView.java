package com.discretesignage.display;

import android.animation.ValueAnimator;
import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Path;
import android.view.View;

final class AvatarPreviewView extends View {
    private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Path ears = new Path();
    private float gazeX, gazeY, pawAngle;
    private ValueAnimator wave;
    private boolean robot;
    private final android.graphics.Shader shell = new android.graphics.LinearGradient(65, 45, 185, 200,
            new int[]{0xffffffff, 0xffe7edf5, 0xffb9c9db}, null, android.graphics.Shader.TileMode.CLAMP);
    void setRobot(boolean value) {
        reset(); robot = value;
        setContentDescription(robot ? "Friendly white robot with blue eyes" : "Friendly orange cat");
        invalidate();
    }
    AvatarPreviewView(Context context) { super(context); setContentDescription("Friendly orange cat"); }
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
        if (robot) { drawRobot(canvas); canvas.restore(); return; }
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
    private void shell(Canvas c, float l, float t, float r, float b, float radius) {
        paint.setShader(shell); c.drawRoundRect(l,t,r,b,radius,radius,paint); paint.setShader(null);
    }
    private void drawRobot(Canvas c) {
        oval(c,0x19274459,52,234,195,247);
        shell(c,82,147,163,225,32);
        oval(c,0xff294659,109,166,136,193);
        oval(c,0xff66e5ff,116,173,129,186);
        shell(c,67,217,116,240,16); shell(c,132,217,181,240,16);
        oval(c,0xffc4d2e2,40,76,73,130); oval(c,0xff6de5fa,44,86,57,119);
        oval(c,0xffc4d2e2,178,76,211,130); oval(c,0xff6de5fa,194,86,207,119);
        shell(c,50,33,200,155,48);
        paint.setColor(0xff101f31); c.drawRoundRect(63,62,187,135,28,28,paint);
        paint.setColor(0xff20364a); c.drawRoundRect(70,68,180,86,12,12,paint);
        oval(c,0xff67e7ff,84+gazeX,87+gazeY,102+gazeX,111+gazeY);
        oval(c,0xff67e7ff,146+gazeX,87+gazeY,164+gazeX,111+gazeY);
        oval(c,0xffd1faff,88+gazeX,89+gazeY,94+gazeX,96+gazeY);
        oval(c,0xffd1faff,150+gazeX,89+gazeY,156+gazeX,96+gazeY);
        paint.setColor(0xff67e7ff); paint.setStyle(Paint.Style.STROKE); paint.setStrokeWidth(3);
        c.drawArc(113,111,137,124,15,150,false,paint); paint.setStyle(Paint.Style.FILL);
        shell(c,160,167,184,213,12);
        c.save(); c.rotate(pawAngle,82,180);
        shell(c,54,158,86,199,16); shell(c,36,143,66,177,13);
        paint.setColor(0xff93a9c0); paint.setStrokeWidth(2);
        c.drawLine(43,151,43,161,paint); c.drawLine(50,149,50,160,paint); c.drawLine(57,151,57,161,paint);
        c.restore();
    }
    @Override protected void onDetachedFromWindow() { reset(); super.onDetachedFromWindow(); }
}
