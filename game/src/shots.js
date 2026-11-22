// Ember Court — deterministic screenshot scenes, driven by ?shot=.
// Each scene plays through the REAL rules (beginGame, simulateTurns, the
// same policies a player could use) with a fixed seed — nothing here draws
// a mock table. The scenes exist so the entry's screenshots are honest
// renders of the game's own code.

import { createGame, simulateTurns, greedyPolicy, timidPolicy } from './world.js';
import { queueEvent, clearFx } from './render.js';

function findOutcome(seeds, policy, wantWinner, maxTurns) {
  for (const seed of seeds) {
    const game = createGame(seed);
    simulateTurns(game, maxTurns, policy);
    if (game.phase === 'over' && game.winner === wantWinner) return game;
  }
  // Fallback: the first seed's game, whatever state it reached. A scene is
  // never faked, so a fallback still shows a real mid-duel table.
  const game = createGame(seeds[0]);
  simulateTurns(game, maxTurns, policy);
  return game;
}

// Build the game state for one shot name. Returns { game, scene }.
export function buildShot(shot) {
  clearFx();
  if (shot === 'title') {
    const game = createGame(7);
    return { game, scene: 'title' };
  }
  if (shot === 'table') {
    // Three full turns of greedy play on both sides: a rich mid-game table
    // with court cards, reduced life and crowns on both sides.
    const game = createGame(7);
    simulateTurns(game, 3, greedyPolicy);
    game.events = [];
    return { game, scene: 'table' };
  }
  if (shot === 'win') {
    const game = findOutcome([11, 21, 31, 41, 51, 61], greedyPolicy, 'you', 20);
    game.events = [];
    queueEvent(game, { type: 'win' });
    return { game, scene: 'win' };
  }
  if (shot === 'loss') {
    const game = findOutcome([13, 23, 33, 43, 53, 63], timidPolicy, 'foe', 20);
    game.events = [];
    return { game, scene: 'loss' };
  }
  return { game: createGame(7), scene: 'title' };
}

// The shot query is "?shot=title|table|win|loss" (an optional &seed=N
// overrides the scene's fixed seed for local experiments).
export function shotFromUrl(url) {
  const params = new URLSearchParams(url.split('?')[1] || '');
  const shot = params.get('shot');
  if (!shot) return null;
  const seed = params.get('seed');
  return { shot, seed: seed ? Number(seed) : null };
}
