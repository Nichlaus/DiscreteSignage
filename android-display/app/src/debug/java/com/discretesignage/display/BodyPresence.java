package com.discretesignage.display;

/** Conservative torso gate, not a distance or identity estimate. */
final class BodyPresence {
    static boolean visible(float[][] torso) {
        if (torso == null || torso.length != 4) return false;
        for (float[] p : torso) {
            if (p == null || p.length != 4) return false;
            for (float value : p) if (!Float.isFinite(value)) return false;
            if (p[0] < 0 || p[0] > 1 || p[1] < 0 || p[1] > 1 || p[2] < .65f || p[3] < .65f) return false;
        }
        // Ignore tiny background poses; validate these thresholds on physical hardware.
        double shoulders = Math.hypot(torso[0][0]-torso[1][0], torso[0][1]-torso[1][1]);
        double height = Math.hypot((torso[0][0]+torso[1][0]-torso[2][0]-torso[3][0])/2,
                (torso[0][1]+torso[1][1]-torso[2][1]-torso[3][1])/2);
        return shoulders >= .08 && height >= .15;
    }
}
