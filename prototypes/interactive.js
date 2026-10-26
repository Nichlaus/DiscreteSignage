import { answers, createInteraction, HOLD_MS, IDLE_MS } from './interaction.js';

const model = createInteraction(), zones = ['Top', 'Left', 'Centre', 'Right', 'Bottom'];
const message = document.querySelector('#message'), cat = document.querySelector('#cat');
const gaze = document.querySelector('#gaze');
const instructions = document.querySelector('#instructions');
const instructionText = instructions.textContent;
let hovered = null, ended = false, answered = false, lastInput = performance.now(), waveTimer;
const container = document.querySelector('.answers');
answers.forEach((answer, zone) => {
  const button = document.createElement('button');
  button.className = 'answer'; button.dataset.zone = zone;
  const label = document.createElement('small'); label.textContent = zones[zone];
  button.append(label, document.createTextNode(answer));
  button.addEventListener('pointerenter', event => { if (event.pointerType !== 'touch') hovered = zone; });
  button.addEventListener('pointerleave', () => { hovered = null; model.update(null, performance.now()); });
  button.addEventListener('click', () => {
    if (ended || answered) return;
    model.reset(); const now = performance.now();
    model.update(zone, now - HOLD_MS); show(model.update(zone, now));
  });
  container.append(button);
});
const buttons = [...container.children];
function show(state) {
  buttons.forEach((button, i) => {
    button.style.setProperty('--hold', `${i === state.target ? state.progress * 100 : 0}%`);
    button.classList.toggle('selected', i === state.target);
  });
  if (state.result && !answered) {
    answered = true; buttons.forEach(button => { button.disabled = true; });
    message.textContent = state.result === 'correct' ? 'You got it! Everest is tallest above sea level.' : 'Good try! The answer is Everest. Want another go?';
    instructions.textContent = message.textContent;
    if (state.result === 'correct') wave();
  }
}
function wave() {
  clearTimeout(waveTimer); cat.classList.remove('waving');
  void cat.getBoundingClientRect(); cat.classList.add('waving');
  waveTimer = setTimeout(() => cat.classList.remove('waving'), 1900);
}
function reset(stop = false) {
  ended = stop; answered = false; hovered = null; model.reset();
  clearTimeout(waveTimer); cat.classList.remove('waving'); gaze.removeAttribute('transform');
  document.body.classList.toggle('ended', stop);
  buttons.forEach(button => { button.disabled = stop; });
  document.querySelector('#wave').disabled = stop;
  message.textContent = stop ? 'Session ended. Select Start over to begin.' : 'Hello! Move your pointer and I’ll look your way.';
  instructions.textContent = stop ? 'Session ended. Start over when you’re ready.' : instructionText;
  show({ target: null, progress: 0 }); lastInput = performance.now();
}
document.querySelector('#wave').onclick = () => { if (!ended) { lastInput = performance.now(); wave(); message.textContent = 'Hello there! Ready for a quick question?'; } };
document.querySelector('#restart').onclick = () => reset();
document.querySelector('#exit').onclick = () => reset(true);
document.addEventListener('keydown', event => { lastInput = performance.now(); if (event.key === 'Escape') reset(true); });
document.addEventListener('pointermove', event => {
  if (ended) return;
  lastInput = performance.now();
  const x = (event.clientX / innerWidth - .5) * 10, y = (event.clientY / innerHeight - .5) * 6;
  gaze.setAttribute('transform', `translate(${x},${y})`);
});
document.addEventListener('visibilitychange', () => { if (document.hidden) reset(true); });
function frame(now) {
  if (!ended) {
    if (now - lastInput >= IDLE_MS) reset(true);
    else if (!answered) show(model.update(hovered, now));
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
