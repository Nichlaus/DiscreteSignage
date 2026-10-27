package com.discretesignage.display;

import android.app.Activity;
import android.hardware.camera2.CameraCharacteristics;
import android.hardware.camera2.CameraManager;
import android.widget.*;

/** Local-only camera controls. Remote screen settings never grant sensor consent. */
final class PresenceSettings {
    static void add(Activity activity, LinearLayout form, Runnable close, ProductOverlay overlay) {
        TextView notice=new TextView(activity);
        notice.setText(PresenceInput.available()
                ? "Local camera greetings · test. Frames stay on this device. No recording or microphone. Each session lasts two minutes; it stops when playback stops or the app leaves the foreground."
                : "Camera greetings are awaiting device acceptance. Touch/remote products and trivia remain available. No camera is enabled in this release.");
        form.addView(notice);
        if(!PresenceInput.available()) return;
        Button stop=new Button(activity);stop.setText("Stop local greeting camera");form.addView(stop);
        stop.setOnClickListener(v->{if(overlay!=null)overlay.stopPresence();close.run();});
        java.util.List<String> ids=new java.util.ArrayList<>(), names=new java.util.ArrayList<>();
        try {
            CameraManager manager=(CameraManager)activity.getSystemService(Activity.CAMERA_SERVICE);
            for(String id:manager.getCameraIdList()) {
                Integer facing=manager.getCameraCharacteristics(id).get(CameraCharacteristics.LENS_FACING);
                ids.add(id); names.add("Camera "+id+" · "+(Integer.valueOf(CameraCharacteristics.LENS_FACING_FRONT).equals(facing)?"front":Integer.valueOf(CameraCharacteristics.LENS_FACING_BACK).equals(facing)?"rear":"external"));
            }
        } catch(android.hardware.camera2.CameraAccessException | SecurityException error) { ids.clear(); names.clear(); }
        if(ids.isEmpty()) {notice.append(" No compatible camera is currently listed.");return;}
        Spinner camera=new Spinner(activity);camera.setContentDescription("Local greeting camera");
        camera.setAdapter(new ArrayAdapter<>(activity,android.R.layout.simple_spinner_dropdown_item,names));form.addView(camera);
        android.content.SharedPreferences preferences=activity.getSharedPreferences("local-camera",Activity.MODE_PRIVATE);
        String saved=preferences.getString("id",null);if(ids.contains(saved))camera.setSelection(ids.indexOf(saved));
        Button start=new Button(activity);start.setText("Start local camera greetings · test");form.addView(start);
        start.setOnClickListener(v->{
            String selected=ids.get(camera.getSelectedItemPosition());preferences.edit().putString("id",selected).apply();close.run();
            if(activity.checkSelfPermission(android.Manifest.permission.CAMERA)!=android.content.pm.PackageManager.PERMISSION_GRANTED) {
                activity.requestPermissions(new String[]{android.Manifest.permission.CAMERA},42);
                Toast.makeText(activity,"After granting permission, return here and select Start again.",Toast.LENGTH_LONG).show();return;
            }
            if(overlay==null || !overlay.startPresence(selected)) Toast.makeText(activity,"Enable interactive products in the portal and play adverts with an available product first.",Toast.LENGTH_LONG).show();
        });

    }
}
