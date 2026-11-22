// Ember Court — the rules and the state of one duel.
// World owns no drawing and no input: it is pure state plus the rules that
// move it, so the screenshot scenes can drive it through the real game.

import { RULES, makeRng, shuffleInPlace } from './config.js';
import { makeDeck, cardDamage } from './cards.js';

export function createPlayer(name, isAi, rng) {
  return {
    name,
    isAi,
    rng,
    life: RULES.startLife,
    crowns: 0,
    embers: RULES.embersPerTurn,
    maxEmbers: RULES.embersPerTurn,
    deck: makeDeck(rng),
    hand: [],
    discard: [],
    lastSuit: null,
    lastCard: null,
    playedSuits: [],
  };
}

export function createGame(seed) {
  const rng = makeRng(seed);
  const game = {
    seed,
    rng,
    phase: 'title', // title | player | ai | over
    turn: 1,
    winner: null,
    message: 'Welcome to the Ember Court.',
    intent: '',
    log: [],
    you: createPlayer('You', false, rng),
    foe: createPlayer('The Courtier', true, rng),
    events: [], // render consumes these for animation + sound, then clears them
  };
  return game;
}

export function drawUpTo(player, count) {
  for (let i = 0; i < count; i += 1) {
    if (player.hand.length >= RULES.maxHand) return;
    if (player.deck.length === 0) {
      if (player.discard.length === 0) return;
      // Reshuffle uses the same seeded rng as the opening deal.
      player.deck = shuffleInPlace(player.rng, player.discard.splice(0));
    }
    player.hand.push(player.deck.pop());
  }
}

// Give a player the embers for a fresh turn and top their hand up.
export function startTurn(game, player) {
  const growth = game.turn >= RULES.emberGrowthTurn ? RULES.emberGrowthStep : 0;
  player.maxEmbers = Math.min(RULES.emberMax, RULES.embersPerTurn + growth);
  player.embers = player.maxEmbers;
  player.playedSuits = [];
  drawUpTo(player, RULES.startHand - player.hand.length);
}

export function beginGame(game) {
  game.phase = 'player';
  game.turn = 1;
  game.you.life = RULES.startLife;
  game.foe.life = RULES.startLife;
  game.you.crowns = 0;
  game.foe.crowns = 0;
  game.you.lastSuit = null;
  game.foe.lastSuit = null;
  game.you.lastCard = null;
  game.foe.lastCard = null;
  game.log = [];
  game.events = [];
  drawUpTo(game.you, RULES.startHand);
  drawUpTo(game.foe, RULES.startHand);
  startTurn(game, game.you);
  game.message = 'Your move — play cards, then end your turn.';
  game.intent = 'The Courtier watches your hand.';
  return game;
}

function pushEvent(game, event) {
  game.events.push(event);
}

function pushLog(game, text) {
  game.log.unshift(text);
  if (game.log.length > 5) game.log.length = 5;
}

// Play one card from a player's hand. Returns false when the card cannot
// be played (wrong phase, not in hand, not enough embers).
export function playCard(game, player, foe, cardId) {
  const index = player.hand.findIndex((c) => c.id === cardId);
  if (index === -1) return null;
  const card = player.hand[index];
  if (card.cost > player.embers) return null;
  player.hand.splice(index, 1);
  player.embers -= card.cost;
  player.discard.push(card);
  player.lastSuit = card.suit;
  player.lastCard = card;
  const result = cardDamage(card, foe.lastSuit, player.playedSuits);
  player.playedSuits.push(card.suit);
  foe.life = Math.max(0, foe.life - result.damage);
  player.crowns += result.damage;
  const who = player.isAi ? 'Courtier' : 'You';
  pushLog(game, `${who} played ${card.value} ${card.suit} for ${result.damage}${result.note ? ` (${result.note})` : ''}.`);
  pushEvent(game, {
    type: 'play',
    card,
    byAi: player.isAi,
    damage: result.damage,
    note: result.note,
    targetLife: foe.life,
  });
  if (foe.life <= 0) {
    game.phase = 'over';
    game.winner = player.isAi ? 'foe' : 'you';
    game.message = player.isAi
      ? 'The Courtier keeps the throne.'
      : 'The Ember Court is yours.';
    pushEvent(game, { type: player.isAi ? 'lose' : 'win' });
  }
  return result;
}

export function endPlayerTurn(game) {
  if (game.phase !== 'player') return;
  game.phase = 'ai';
  game.message = 'The Courtier takes the table…';
  game.intent = 'The Courtier is weighing your last card.';
  pushEvent(game, { type: 'turn', to: 'ai' });
}

// One AI step: play its single best affordable card, or null when it passes.
export function aiStep(game) {
  const ai = game.foe;
  const you = game.you;
  let best = null;
  let bestScore = 4; // the Courtier only plays a card worth playing
  for (const card of ai.hand) {
    if (card.cost > ai.embers) continue;
    const result = cardDamage(card, you.lastSuit, ai.playedSuits);
    const score = result.damage * 2 - card.cost * 2 + (result.bonus > 0 ? 2 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = card;
    }
  }
  if (!best) return null;
  return playCard(game, ai, you, best.id);
}

export function endAiTurn(game) {
  if (game.phase !== 'ai') return;
  game.turn += 1;
  game.phase = 'player';
  startTurn(game, game.you);
  startTurn(game, game.foe);
  game.message = `Turn ${game.turn} — your move.`;
  game.intent = aiIntent(game);
  pushEvent(game, { type: 'turn', to: 'player' });
}

// What the Courtier is thinking, in plain sight: the player can read the
// suit it favours and answer with the suit that beats it.
export function aiIntent(game) {
  const favoured = game.foe.hand.length
    ? game.foe.hand.reduce((a, b) => (b.value > a.value ? b : a)).suit
    : null;
  if (!favoured) return 'The Courtier has nothing to play.';
  const beats = { flame: 'Thorn', thorn: 'Tide', tide: 'Flame' };
  return `The Courtier favours ${favoured} — ${beats[favoured] || 'Star'} answers it.`;
}

export function restart(game) {
  const fresh = createGame(game.seed + 1);
  fresh.phase = 'player';
  beginGame(fresh);
  return fresh;
}

// Drive whole turns synchronously with a player policy, for the screenshot
// scenes and for tests. The policy picks a card id to play, or null to end
// the turn. Everything still goes through playCard and aiStep, so the scenes
// are the real game, not a drawing of one.
export function simulateTurns(game, maxTurns, playerPolicy) {
  beginGame(game);
  let guard = 0;
  while (game.phase !== 'over' && game.turn <= maxTurns && guard < 400) {
    guard += 1;
    if (game.phase === 'player') {
      const pick = playerPolicy(game);
      if (pick == null) {
        endPlayerTurn(game);
      } else if (!playCard(game, game.you, game.foe, pick)) {
        endPlayerTurn(game);
      }
    } else if (game.phase === 'ai') {
      let steps = 0;
      while (aiStep(game) && game.phase === 'ai' && steps < 8) steps += 1;
      if (game.phase === 'ai') endAiTurn(game);
    }
  }
  return game;
}

// A player policy that plays the strongest affordable card each time.
export function greedyPolicy(game) {
  let best = null;
  let bestScore = -1;
  for (const card of game.you.hand) {
    if (card.cost > game.you.embers) continue;
    const result = cardDamage(card, game.foe.lastSuit, game.you.playedSuits);
    const score = result.damage * 2 - card.cost;
    if (score > bestScore) {
      bestScore = score;
      best = card;
    }
  }
  return best ? best.id : null;
}

// A player policy that plays the weakest affordable card — a bad hand,
// used to stage a loss through the real rules.
export function timidPolicy(game) {
  let worst = null;
  for (const card of game.you.hand) {
    if (card.cost > game.you.embers) continue;
    if (!worst || card.value < worst.value) worst = card;
  }
  return worst ? worst.id : null;
}
