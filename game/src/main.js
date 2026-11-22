// Ember Court — boot and the game loop.
// Owns the canvas, the clock, the AI's pacing and the wiring between the
// world, the renderer, input and sound. It holds no rules of its own.

import { VIEW } from './config.js';
import { createGame, beginGame, playCard, endPlayerTurn, aiStep, endAiTurn, restart } from './world.js';
import { render, queueEvent, clearFx, playerHandRects } from './render.js';
import { toLogical, pointerIntent, keyIntent, cardAt } from './input.js';
import * as audio from './audio.js';
import { buildShot, shotFromUrl } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
canvas.width = VIEW.width;
canvas.height = VIEW.height;

const shot = shotFromUrl(window.location.search);
let game = shot ? buildShot(shot.shot).game : createGame(20261122);
// A read-only handle for play-tests and debugging (never used by the game).
window.__ember = {
  get game() { return game; },
  get ui() { return ui; },
};
if (shot) {
  // Screenshot scenes render once, instantly, with no animation timers:
  // the frame below is the finished state, not a moment mid-flight.
  game.events = [];
}

const ui = { hoverCardId: null, muted: false };
let lastMessage = '';
let aiTimer = 0;
let lastTime = performance.now();

function announce() {
  if (game.message !== lastMessage) {
    lastMessage = game.message;
    statusEl.textContent = `${game.message} Your life ${game.you.life}, Courtier life ${game.foe.life}.`;
  }
}

// Drain the world's events into sound and animation, then clear them.
function drainEvents() {
  for (const event of game.events) {
    if (event.type === 'play') {
      audio.playCard();
      audio.playHit();
      queueEvent(game, event, lastPlayedFrom);
      lastPlayedFrom = null;
    } else if (event.type === 'win') {
      audio.playWin();
      queueEvent(game, event);
    } else if (event.type === 'lose') {
      audio.playLose();
      queueEvent(game, event);
    } else if (event.type === 'turn') {
      audio.playTurn();
    }
  }
  game.events = [];
}

let lastPlayedFrom = null;

function act(intent) {
  if (intent.type === 'none') return;
  if (intent.type === 'mute') {
    ui.muted = audio.toggleMute();
    return;
  }
  if (intent.type === 'start') {
    audio.playClick();
    beginGame(game);
    drainEvents();
    return;
  }
  if (intent.type === 'restart') {
    audio.playClick();
    clearFx();
    game = restart(game);
    drainEvents();
    return;
  }
  if (intent.type === 'endTurn') {
    audio.playClick();
    endPlayerTurn(game);
    aiTimer = 0;
    drainEvents();
    return;
  }
  if (intent.type === 'play') {
    const rects = playerHandRects(game);
    const rect = rects.find((r) => r.card.id === intent.cardId);
    if (rect) lastPlayedFrom = { x: rect.x, y: rect.y, w: rect.w, h: rect.h };
    const result = playCard(game, game.you, game.foe, intent.cardId);
    if (!result) {
      audio.playClick();
      game.message = 'Not enough embers for that card.';
    }
    drainEvents();
  }
}

canvas.addEventListener('mousemove', (event) => {
  if (game.phase !== 'player') {
    ui.hoverCardId = null;
    return;
  }
  const point = toLogical(canvas, event);
  const card = cardAt(game, point);
  ui.hoverCardId = card ? card.id : null;
});

canvas.addEventListener('click', (event) => {
  const point = toLogical(canvas, event);
  act(pointerIntent(game, point));
});

window.addEventListener('keydown', (event) => {
  if ([' ', 'Enter'].includes(event.key)) event.preventDefault();
  act(keyIntent(game, event.key));
});

// The Courtier plays one card at a time so its choices can be read.
function stepAi(dt) {
  if (game.phase !== 'ai') return;
  aiTimer += dt;
  if (aiTimer < 0.7) return;
  aiTimer = 0;
  const played = aiStep(game);
  drainEvents();
  if (!played) endAiTurn(game);
}

function frame(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  stepAi(dt);
  announce();
  render(ctx, game, ui, dt);
  requestAnimationFrame(frame);
}

if (shot) {
  // Let the scene settle (confetti falls into view, embers drift) and then
  // draw one finished frame, and signal readiness for the screenshot runner.
  for (let i = 0; i < 24; i += 1) render(ctx, game, ui, 1 / 12);
  announce();
  document.title = 'Ember Court — ready';
  window.__ready = true;
} else {
  requestAnimationFrame(frame);
}
