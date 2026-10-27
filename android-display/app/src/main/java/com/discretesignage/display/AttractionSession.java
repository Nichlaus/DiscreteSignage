package com.discretesignage.display;

/** Monotonic, local interaction policy; presence alone never opens a product. */
final class AttractionSession {
    enum Stage { ADVERTISING, GREETING, PRODUCT }
    private Stage stage = Stage.ADVERTISING;
    private long presentSince = -1, until, cooldownUntil;
    private boolean present, needsDeparture;
    private long absentSince = -1;

    Stage update(boolean nearby, long now) {
        present = nearby;
        if (!nearby) {
            presentSince = -1;
            if (stage != Stage.ADVERTISING) end(now);
            if (absentSince < 0) absentSince = now;
            if (now - absentSince >= 2000) needsDeparture = false;
        } else {
            absentSince = -1;
            if (stage != Stage.ADVERTISING && now >= until) end(now);
            if (needsDeparture || now < cooldownUntil) presentSince = -1;
            else if (stage == Stage.ADVERTISING) {
                if (presentSince < 0) presentSince = now;
                if (now - presentSince >= 2000) { stage = Stage.GREETING; needsDeparture = true; until = now + 8000; }
            }
        }
        return stage;
    }
    boolean engage(long now) {
        if (!present || stage != Stage.GREETING || now >= until) return false;
        stage = Stage.PRODUCT; until = now + 20000; return true;
    }
    void end(long now) {
        stage = Stage.ADVERTISING; presentSince = -1; cooldownUntil = now + 30000;
    }
    Stage stage() { return stage; }
}
