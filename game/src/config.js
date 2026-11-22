// Ember Court — tunables and table layout.
// One place for every number the rest of the game reads, so balancing the
// duel means editing this file and nothing else.

export const VIEW = { width: 1280, height: 800 };

export const RULES = {
  startLife: 60,
  startHand: 5,
  maxHand: 7,
  embersPerTurn: 3,
  // Ember income grows as the duel goes on, so late turns play bigger cards.
  emberGrowthTurn: 4,
  emberGrowthStep: 1,
  emberMax: 6,
  suitBeatBonus: 2,
  suitLosePenalty: 1,
  resonanceBonus: 2,
  deckSuits: 4,
  deckValues: 10,
};

export const SUITS = {
  flame: { name: 'Flame', color: '#e2482e', dark: '#8f1d0c', light: '#ffe3d8', glyph: 'flame' },
  tide: { name: 'Tide', color: '#2b7fd4', dark: '#144a86', light: '#dbeeff', glyph: 'tide' },
  thorn: { name: 'Thorn', color: '#3da35a', dark: '#1c5c30', light: '#dcf3e2', glyph: 'thorn' },
  star: { name: 'Star', color: '#c98a12', dark: '#7a5200', light: '#fff3cf', glyph: 'star' },
};

// The suit cycle the whole duel turns on. A beats B, B beats C, C beats A;
// Star stands outside the cycle: it never gains or loses the matchup bonus.
export const SUIT_CYCLE = ['flame', 'thorn', 'tide'];
export const SUIT_BEATS = { flame: 'thorn', thorn: 'tide', tide: 'flame', star: null };

export const COLORS = {
  felt: '#14532d',
  feltDark: '#0d3a1f',
  feltLight: '#1d6b3a',
  rail: '#7a5a22',
  railLight: '#c9a24b',
  gold: '#e8b64c',
  ivory: '#f7f1de',
  ink: '#241a10',
  panel: '#1c130a',
  panelEdge: '#4a3413',
  good: '#7ee787',
  bad: '#ff7b72',
  ember: '#ff9f2e',
};

export const LAYOUT = {
  hudHeight: 64,
  oppHandY: 84,
  oppCardW: 76,
  oppCardH: 106,
  courtY: 250,
  courtH: 220,
  handY: 618,
  cardW: 112,
  cardH: 152,
  cardGap: 14,
  endTurn: { x: 1130, y: 640, w: 120, h: 52 },
  mute: { x: 1204, y: 748, w: 64, h: 36 },
};

// Seeded RNG (mulberry32) so screenshot scenes replay exactly.
export function makeRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffleInPlace(rng, arr) {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
