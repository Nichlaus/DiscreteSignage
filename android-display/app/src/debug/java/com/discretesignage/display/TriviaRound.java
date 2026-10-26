package com.discretesignage.display;

/** Curated offline questions; scores exist only for this round. */
final class TriviaRound {
    private static final String[] QUESTIONS = {
            "Which mountain is tallest above sea level?",
            "Which planet is known as the Red Planet?",
            "How many sides does a triangle have?"};
    private static final String[][] OPTIONS = {
            {"Kilimanjaro", "K2", "Everest", "Mont Blanc", "Fuji"},
            {"Venus", "Mars", "Jupiter", "Mercury", "Saturn"},
            {"Four", "Five", "Six", "Three", "Eight"}};
    private static final int[] CORRECT = {2, 1, 3};
    private int index, score;
    private boolean answered;

    String question() { return QUESTIONS[index]; }
    String option(int answer) { return OPTIONS[index][answer]; }
    int number() { return index + 1; }
    int score() { return score; }
    boolean complete() { return answered && index == QUESTIONS.length - 1; }
    boolean answer(int answer) {
        if (answered || answer < 0 || answer >= 5) return false;
        answered = true;
        if (answer == CORRECT[index]) { score++; return true; }
        return false;
    }
    String feedback() {
        return index == 0 ? "Everest is tallest above sea level." : "The answer is " + option(CORRECT[index]) + ".";
    }
    boolean next() {
        if (!answered || complete()) return false;
        index++; answered = false; return true;
    }
    void reset() { index = 0; score = 0; answered = false; }
}
