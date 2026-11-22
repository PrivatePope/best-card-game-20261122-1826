// Ember Court — the deck, the suits and what a card is worth.
// Every card is an original Ember Court card: four invented suits, values
// 1-10, and an ember cost that rises with the value.

import { RULES, SUITS, SUIT_BEATS, shuffleInPlace } from './config.js';

export const SUIT_KEYS = Object.keys(SUITS);

export function cardCost(value) {
  // 1-3 -> 1 ember, 4-6 -> 2, 7-9 -> 3, 10 -> 4.
  return Math.min(4, 1 + Math.floor((value - 1) / 3));
}

export function makeDeck(rng) {
  const deck = [];
  let id = 0;
  for (const suit of SUIT_KEYS) {
    for (let value = 1; value <= RULES.deckValues; value += 1) {
      deck.push({ id: id++, suit, value, cost: cardCost(value) });
    }
  }
  return shuffleInPlace(rng, deck);
}

export function suitBeats(attackerSuit, defenderSuit) {
  if (!attackerSuit || !defenderSuit) return 0;
  if (SUIT_BEATS[attackerSuit] === defenderSuit) return 1;
  if (SUIT_BEATS[defenderSuit] === attackerSuit) return -1;
  return 0;
}

export function suitName(suit) {
  return SUITS[suit].name;
}

export function suitColor(suit) {
  return SUITS[suit].color;
}

// Damage a card deals when it is played. The matchup against the other
// side's last court card and a same-suit resonance decide the bonus.
export function cardDamage(card, defenderLastSuit, playedSuitsThisTurn) {
  let damage = card.value;
  let bonus = 0;
  let note = '';
  const matchup = suitBeats(card.suit, defenderLastSuit);
  if (matchup === 1) {
    bonus += RULES.suitBeatBonus;
    note = 'beats ' + suitName(defenderLastSuit);
  } else if (matchup === -1) {
    bonus -= RULES.suitLosePenalty;
    note = 'weak vs ' + suitName(defenderLastSuit);
  }
  if (playedSuitsThisTurn.includes(card.suit)) {
    bonus += RULES.resonanceBonus;
    note = note ? note + ' + resonance' : 'resonance';
  }
  damage = Math.max(1, damage + bonus);
  return { damage, bonus, note };
}
