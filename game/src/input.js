// Ember Court — mouse and keyboard play.
// Input reads the world and the renderer's rectangles and returns plain
// intents; main.js is the only place that acts on them.

import { LAYOUT } from './config.js';
import { playerHandRects } from './render.js';

// Convert a pointer event on the canvas to logical 1280x800 coordinates.
export function toLogical(canvas, event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * 1280,
    y: ((event.clientY - rect.top) / rect.height) * 800,
  };
}

function inside(point, rect) {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.w &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.h
  );
}

// Which hand card, if any, sits under this point (topmost first: the
// hovered card is drawn lifted, so test from the top of the fan down).
export function cardAt(game, point) {
  const rects = playerHandRects(game);
  for (let i = rects.length - 1; i >= 0; i -= 1) {
    const r = rects[i];
    const lifted = { ...r, y: r.y - 18, h: r.h + 18 };
    if (inside(point, lifted)) return r.card;
  }
  return null;
}

export function pointerIntent(game, point) {
  if (inside(point, LAYOUT.mute)) return { type: 'mute' };
  if (game.phase === 'title') return { type: 'start' };
  if (game.phase === 'over') return { type: 'restart' };
  if (game.phase === 'player' && inside(point, LAYOUT.endTurn)) return { type: 'endTurn' };
  if (game.phase === 'player') {
    const card = cardAt(game, point);
    if (card) return { type: 'play', cardId: card.id };
  }
  return { type: 'none' };
}

// Keys: Enter/Space starts the game or ends a turn, 1-7 play from the hand,
// R restarts, M mutes. Returns the same intent shapes as pointerIntent.
export function keyIntent(game, key) {
  const k = key.toLowerCase();
  if (k === 'm') return { type: 'mute' };
  if (k === 'r') return { type: 'restart' };
  if (game.phase === 'title' && (k === 'enter' || k === ' ')) return { type: 'start' };
  if (game.phase === 'over' && (k === 'enter' || k === ' ')) return { type: 'restart' };
  if (game.phase === 'player' && (k === 'enter' || k === ' ')) return { type: 'endTurn' };
  if (game.phase === 'player' && /^[1-7]$/.test(k)) {
    const card = game.you.hand[Number(k) - 1];
    if (card) return { type: 'play', cardId: card.id };
  }
  return { type: 'none' };
}
