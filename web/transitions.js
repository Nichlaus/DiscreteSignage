// Animate media inside the rotated stage so orientation and scaling stay intact.
export async function swapContent(stage, content, effect = 'fade') {
  const previous = [...stage.children];
  stage.append(content);
  const frames = {
    fade: [{ opacity: 0 }, { opacity: 1 }],
    slide: [{ transform: 'translateX(100%)' }, { transform: 'translateX(0)' }],
    zoom: [{ opacity: 0, transform: 'scale(.92)' }, { opacity: 1, transform: 'scale(1)' }],
  };
  try {
    if (previous.length && frames[effect] && content.animate && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      await content.animate(frames[effect], { duration: 450, easing: 'ease-out' }).finished;
    }
  } catch { /* Cancellation falls back to a direct cut. */ }
  for (const old of previous) { old.dispose?.(); old.remove(); }
}
