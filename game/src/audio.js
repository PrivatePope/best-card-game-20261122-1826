// Ember Court — sound, synthesised live with WebAudio. No audio files,
// no network: every blip, chord and flourish is an oscillator.

let ctx = null;
let muted = false;

export function isMuted() {
  return muted;
}

export function toggleMute() {
  muted = !muted;
  return muted;
}

function audio() {
  if (muted) return null;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function tone(freq, dur, type, gain, when = 0, slideTo = null) {
  const ac = audio();
  if (!ac) return;
  const t0 = ac.currentTime + when;
  const osc = ac.createOscillator();
  const amp = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  amp.gain.setValueAtTime(0.0001, t0);
  amp.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(amp).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

export function playDraw() {
  tone(620, 0.09, 'triangle', 0.08, 0, 940);
}

export function playCard() {
  tone(330, 0.12, 'triangle', 0.12, 0, 520);
  tone(495, 0.1, 'sine', 0.06, 0.03);
}

export function playHit() {
  tone(180, 0.18, 'sawtooth', 0.1, 0, 90);
  tone(90, 0.22, 'square', 0.06, 0.02, 55);
}

export function playTurn() {
  tone(440, 0.1, 'sine', 0.07);
  tone(660, 0.12, 'sine', 0.07, 0.09);
}

export function playWin() {
  [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.35, 'triangle', 0.1, i * 0.11));
  tone(1319, 0.5, 'sine', 0.08, 0.48);
}

export function playLose() {
  [392, 330, 262, 196].forEach((f, i) => tone(f, 0.4, 'sine', 0.09, i * 0.14));
}

export function playClick() {
  tone(880, 0.05, 'square', 0.04);
}
