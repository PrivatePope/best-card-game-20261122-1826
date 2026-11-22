// Ember Court — the Courtier's mind.
// The opponent is readable on purpose: it always plays the card that gains
// the most right now, it favours the suit that beats your last court card,
// and it stops when nothing it holds is worth the embers. The table shows
// its intent line so you can answer it with the suit that beats it.

import { cardDamage } from './cards.js';

// Score one candidate card for the Courtier. Damage counts double, embers
// count against, and a matchup or resonance bonus tips the scale.
export function scoreCard(game, card) {
  const result = cardDamage(card, game.you.lastSuit, game.foe.playedSuits);
  return {
    card,
    result,
    score: result.damage * 2 - card.cost * 2 + (result.bonus > 0 ? 2 : 0),
  };
}

// The Courtier's whole turn, as a list of card ids in the order it will
// play them. Pure: it reads the state and plans, it does not change it.
export function planAiTurn(game) {
  const planned = [];
  const embersLeft = { value: game.foe.embers };
  const playedSuits = [...game.foe.playedSuits];
  const hand = [...game.foe.hand];
  while (true) {
    let best = null;
    let bestScore = 4;
    for (const card of hand) {
      if (card.cost > embersLeft.value) continue;
      const result = cardDamage(card, game.you.lastSuit, playedSuits);
      const score = result.damage * 2 - card.cost * 2 + (result.bonus > 0 ? 2 : 0);
      if (score > bestScore) {
        bestScore = score;
        best = { card, result };
      }
    }
    if (!best) break;
    planned.push(best.card.id);
    embersLeft.value -= best.card.cost;
    playedSuits.push(best.card.suit);
    hand.splice(hand.indexOf(best.card), 1);
  }
  return planned;
}

// The suit the Courtier will lean on this turn, for the intent line.
export function favouredSuit(game) {
  if (!game.foe.hand.length) return null;
  return game.foe.hand.reduce((a, b) => (b.value > a.value ? b : a)).suit;
}
