package com.discretesignage.display;

import org.junit.Test;
import static org.junit.Assert.*;

public class TriviaRoundTest {
    @Test public void onlyOneAnswerPerQuestionAndThreeQuestionsPerRound() {
        TriviaRound round = new TriviaRound();
        assertFalse(round.next());
        assertFalse(round.answer(-1));
        assertTrue(round.answer(2));
        assertFalse(round.answer(2));
        assertEquals(1, round.score());
        assertTrue(round.next());
        assertFalse(round.answer(0));
        assertFalse(round.answer(1));
        assertEquals(1, round.score());
        assertTrue(round.next());
        assertTrue(round.answer(3));
        assertTrue(round.complete());
        assertFalse(round.next());
        assertEquals(2, round.score());
        round.reset();
        assertEquals(1, round.number());
        assertEquals(0, round.score());
        assertFalse(round.complete());
        assertTrue(round.answer(2));
    }
}
