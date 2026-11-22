// Ember Court — everything the eye sees, drawn on one canvas.
// Table, cards, HUD, title / win / loss screens, and the feel: cards that
// slide, flip and snap, floating damage, screen shake, win confetti. The
// renderer reads the world and never changes it.

import { VIEW, COLORS, LAYOUT, SUITS, RULES, makeRng } from './config.js';

// ---- animation state (render-owned, never in the world) -------------------
const fx = {
  flying: [], // {card, byAi, from, to, t, dur}
  floats: [], // {x, y, text, color, t}
  confetti: [], // {x, y, vx, vy, color, rot, vr, t}
  shake: 0,
  embers: [], // drifting title-screen embers
  time: 0,
};

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ---- suit glyphs: colour AND shape, never text alone ----------------------
export function drawGlyph(ctx, glyph, cx, cy, size, color) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = size * 0.09;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const s = size / 2;
  if (glyph === 'flame') {
    ctx.beginPath();
    ctx.moveTo(0, -s);
    ctx.bezierCurveTo(s * 0.7, -s * 0.2, s * 0.9, s * 0.35, s * 0.55, s * 0.8);
    ctx.bezierCurveTo(s * 0.2, s * 1.05, -s * 0.2, s * 1.05, -s * 0.55, s * 0.8);
    ctx.bezierCurveTo(-s * 0.9, s * 0.35, -s * 0.7, -s * 0.2, 0, -s);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.1);
    ctx.bezierCurveTo(s * 0.35, s * 0.25, s * 0.3, s * 0.6, 0, s * 0.7);
    ctx.bezierCurveTo(-s * 0.3, s * 0.6, -s * 0.35, s * 0.25, 0, -s * 0.1);
    ctx.fill();
  } else if (glyph === 'tide') {
    for (let row = -1; row <= 1; row += 1) {
      ctx.beginPath();
      ctx.moveTo(-s, row * s * 0.55);
      ctx.quadraticCurveTo(-s * 0.5, row * s * 0.55 - s * 0.45, 0, row * s * 0.55);
      ctx.quadraticCurveTo(s * 0.5, row * s * 0.55 + s * 0.45, s, row * s * 0.55);
      ctx.stroke();
    }
  } else if (glyph === 'thorn') {
    ctx.beginPath();
    ctx.moveTo(0, -s);
    ctx.quadraticCurveTo(s * 0.95, -s * 0.1, s * 0.35, s * 0.75);
    ctx.quadraticCurveTo(-s * 0.35, s * 0.95, -s * 0.7, s * 0.1);
    ctx.quadraticCurveTo(-s * 0.55, -s * 0.6, 0, -s);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.7);
    ctx.lineTo(0, s);
    ctx.stroke();
  } else {
    // star: five-pointed
    ctx.beginPath();
    for (let i = 0; i < 10; i += 1) {
      const r = i % 2 === 0 ? s : s * 0.45;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

// ---- cards -----------------------------------------------------------------
export function drawCard(ctx, card, x, y, w, h, opts = {}) {
  const suit = SUITS[card.suit];
  const lift = opts.hover ? -18 : 0;
  const yy = y + lift;
  ctx.save();
  if (opts.dim) ctx.globalAlpha = 0.45;
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 5;
  roundRect(ctx, x, yy, w, h, 10);
  ctx.fillStyle = COLORS.ivory;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.lineWidth = opts.hover ? 5 : 3;
  ctx.strokeStyle = suit.color;
  ctx.stroke();
  // Inner frame in the suit colour.
  roundRect(ctx, x + 6, yy + 6, w - 12, h - 12, 7);
  ctx.lineWidth = 1;
  ctx.strokeStyle = suit.light;
  ctx.stroke();
  // Big value, top left.
  ctx.fillStyle = suit.dark;
  ctx.font = `bold ${Math.round(w * 0.42)}px Georgia, serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(String(card.value), x + 12, yy + 8);
  // Ember cost: orange pips, top right.
  const pipR = Math.max(4, w * 0.055);
  for (let i = 0; i < card.cost; i += 1) {
    ctx.beginPath();
    ctx.arc(x + w - 14 - i * (pipR * 2 + 3), yy + 16, pipR, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.ember;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#7a3c00';
    ctx.stroke();
  }
  // The suit glyph, large in the middle.
  drawGlyph(ctx, suit.glyph, x + w / 2, yy + h * 0.52, w * 0.52, suit.color);
  // Suit name along the bottom, with a coloured band.
  ctx.fillStyle = suit.color;
  roundRect(ctx, x + 10, yy + h - 30, w - 20, 20, 5);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${Math.round(w * 0.13)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(suit.name.toUpperCase(), x + w / 2, yy + h - 19);
  ctx.restore();
}

export function drawCardBack(ctx, x, y, w, h) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 4;
  roundRect(ctx, x, y, w, h, 9);
  ctx.fillStyle = '#3a1c5e';
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.lineWidth = 2;
  ctx.strokeStyle = COLORS.gold;
  ctx.stroke();
  roundRect(ctx, x + 6, y + 6, w - 12, h - 12, 6);
  ctx.strokeStyle = 'rgba(232,182,76,0.6)';
  ctx.lineWidth = 1;
  ctx.stroke();
  // Gold diamond lattice on the back.
  ctx.strokeStyle = 'rgba(232,182,76,0.85)';
  ctx.lineWidth = 1.5;
  const cx = x + w / 2;
  const cy = y + h / 2;
  ctx.beginPath();
  ctx.moveTo(cx, cy - h * 0.28);
  ctx.lineTo(cx + w * 0.28, cy);
  ctx.lineTo(cx, cy + h * 0.28);
  ctx.lineTo(cx - w * 0.28, cy);
  ctx.closePath();
  ctx.stroke();
  ctx.fillStyle = COLORS.gold;
  ctx.beginPath();
  ctx.arc(cx, cy, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ---- layout helpers shared with input.js -----------------------------------
export function playerHandRects(game) {
  const hand = game.you.hand;
  const { cardW, cardH, cardGap, handY } = LAYOUT;
  const total = hand.length * cardW + (hand.length - 1) * cardGap;
  const startX = (VIEW.width - total) / 2;
  return hand.map((card, i) => ({
    card,
    x: startX + i * (cardW + cardGap),
    y: handY + Math.abs(i - (hand.length - 1) / 2) * 5,
    w: cardW,
    h: cardH,
  }));
}

export function oppHandRects(game) {
  const n = game.foe.hand.length;
  const { oppCardW, oppCardH, oppHandY } = LAYOUT;
  const gap = 10;
  const total = n * oppCardW + (n - 1) * gap;
  const startX = (VIEW.width - total) / 2;
  return Array.from({ length: n }, (_, i) => ({
    x: startX + i * (oppCardW + gap),
    y: oppHandY,
    w: oppCardW,
    h: oppCardH,
  }));
}

export function courtRects() {
  return {
    you: { x: 470, y: LAYOUT.courtY, w: 140, h: 190 },
    foe: { x: 670, y: LAYOUT.courtY, w: 140, h: 190 },
  };
}

// ---- HUD --------------------------------------------------------------------
function drawLifeBar(ctx, x, y, w, label, life, maxLife, crowns, alignRight) {
  ctx.save();
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#fff';
  ctx.textAlign = alignRight ? 'right' : 'left';
  const labelX = alignRight ? x + w : x;
  ctx.fillText(label, labelX, y - 10);
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  roundRect(ctx, x, y, w, 18, 9);
  ctx.fill();
  const frac = Math.max(0, life / maxLife);
  ctx.fillStyle = frac > 0.5 ? '#58c96b' : frac > 0.25 ? '#e8b64c' : '#e2482e';
  if (frac > 0) {
    roundRect(ctx, x + 2, y + 2, Math.max(8, (w - 4) * frac), 14, 7);
    ctx.fill();
  }
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`♥ ${life}`, x + w / 2, y + 10);
  ctx.textAlign = alignRight ? 'right' : 'left';
  ctx.fillStyle = COLORS.gold;
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.fillText(`♛ ${crowns} crowns`, labelX, y + 34);
  ctx.restore();
}

function drawHud(ctx, game) {
  ctx.save();
  ctx.fillStyle = 'rgba(10,20,12,0.55)';
  ctx.fillRect(0, 0, VIEW.width, LAYOUT.hudHeight);
  drawLifeBar(ctx, 24, 40, 240, 'YOU', game.you.life, RULES.startLife, game.you.crowns, false);
  drawLifeBar(ctx, VIEW.width - 264, 40, 240, 'THE COURTIER', game.foe.life, RULES.startLife, game.foe.crowns, true);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 17px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`Turn ${game.turn}`, VIEW.width / 2, 30);
  ctx.fillStyle = '#ffe9b0';
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillText(game.message, VIEW.width / 2, 54);
  ctx.restore();
}

// Embers sit in the clear strip above the End Turn button — never over the
// hand, which can stretch to x=948 when it holds five cards.
function drawEmbers(ctx, game) {
  const y = 608;
  ctx.save();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 16px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('Embers', 1020, y);
  for (let i = 0; i < game.you.maxEmbers; i += 1) {
    ctx.beginPath();
    ctx.arc(1110 + i * 22, y, 8, 0, Math.PI * 2);
    ctx.fillStyle = i < game.you.embers ? COLORS.ember : 'rgba(255,255,255,0.25)';
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#7a3c00';
    ctx.stroke();
  }
  ctx.restore();
}

function drawButton(ctx, rect, label, enabled) {
  ctx.save();
  roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 10);
  ctx.fillStyle = enabled ? COLORS.gold : 'rgba(255,255,255,0.18)';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = enabled ? '#7a5200' : 'rgba(255,255,255,0.3)';
  ctx.stroke();
  ctx.fillStyle = enabled ? '#241a10' : 'rgba(255,255,255,0.6)';
  ctx.font = 'bold 17px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2 + 1);
  ctx.restore();
}

function drawDecks(ctx, game) {
  ctx.save();
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  drawCardBack(ctx, 24, 300, 56, 78);
  ctx.fillStyle = '#fff';
  ctx.fillText(`Deck ${game.you.deck.length}`, 52, 392);
  drawCardBack(ctx, VIEW.width - 80, 84, 56, 78);
  ctx.fillText(`Deck ${game.foe.deck.length}`, VIEW.width - 52, 176);
  ctx.restore();
}

function drawLog(ctx, game) {
  ctx.save();
  ctx.fillStyle = 'rgba(10,20,12,0.5)';
  roundRect(ctx, 20, 420, 240, 150, 10);
  ctx.fill();
  ctx.fillStyle = COLORS.gold;
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('THE TABLE TALKS', 32, 432);
  ctx.fillStyle = '#e8e2cf';
  ctx.font = '13px system-ui, sans-serif';
  game.log.forEach((line, i) => {
    ctx.fillText('• ' + line, 32, 456 + i * 20, 216);
  });
  ctx.restore();
}

function drawSuitGuide(ctx) {
  const x = 1020;
  const y = 420;
  ctx.save();
  ctx.fillStyle = 'rgba(10,20,12,0.5)';
  roundRect(ctx, x, y, 240, 150, 10);
  ctx.fill();
  ctx.fillStyle = COLORS.gold;
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('THE SUIT CYCLE', x + 12, y + 12);
  const rows = [
    ['flame', 'beats', 'thorn'],
    ['thorn', 'beats', 'tide'],
    ['tide', 'beats', 'flame'],
    ['star', 'wild', 'no weakness'],
  ];
  rows.forEach(([a, verb, b], i) => {
    const ry = y + 38 + i * 26;
    drawGlyph(ctx, SUITS[a].glyph, x + 26, ry + 8, 18, SUITS[a].color);
    ctx.fillStyle = '#e8e2cf';
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText(`${SUITS[a].name} ${verb} ${SUITS[b] ? SUITS[b].name : b}`, x + 44, ry);
  });
  ctx.restore();
}

// ---- court -------------------------------------------------------------------
function drawCourt(ctx, game) {
  const { you, foe } = courtRects();
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  roundRect(ctx, 300, LAYOUT.courtY - 16, 680, LAYOUT.courtH + 32, 18);
  ctx.fill();
  ctx.strokeStyle = 'rgba(232,182,76,0.5)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = COLORS.gold;
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('THE COURT', 640, LAYOUT.courtY + 2);
  // Last cards each side played, or an empty slot.
  if (game.you.lastCard) drawCard(ctx, game.you.lastCard, you.x, you.y + 16, you.w, you.h);
  else {
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.setLineDash([6, 6]);
    roundRect(ctx, you.x, you.y + 16, you.w, you.h, 10);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText('your card', you.x + you.w / 2, you.y + 110);
  }
  if (game.foe.lastCard) drawCard(ctx, game.foe.lastCard, foe.x, foe.y + 16, foe.w, foe.h);
  else {
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.setLineDash([6, 6]);
    roundRect(ctx, foe.x, foe.y + 16, foe.w, foe.h, 10);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText('their card', foe.x + foe.w / 2, foe.y + 110);
  }
  // The readable matchup: which suit beats which, right between the cards.
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 26px Georgia, serif';
  ctx.fillText('⚔', 640, LAYOUT.courtY + 108);
  if (game.you.lastCard && game.foe.lastCard) {
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillStyle = '#ffe9b0';
    const a = game.you.lastCard.suit;
    const b = game.foe.lastCard.suit;
    const beats = { flame: 'thorn', thorn: 'tide', tide: 'flame' };
    let note = 'Star is wild — no bonus either way.';
    if (beats[a] === b) note = `${SUITS[a].name} beats ${SUITS[b].name} — your edge!`;
    if (beats[b] === a) note = `${SUITS[b].name} beats ${SUITS[a].name} — answer it!`;
    // Below the court cards, on the dark panel — never over a white card.
    ctx.fillText(note, 640, LAYOUT.courtY + 220);
  }
  // The Courtier's readable intent, under the court panel.
  ctx.font = 'italic 15px Georgia, serif';
  ctx.fillStyle = '#ffe9b0';
  ctx.fillText(game.intent, 640, LAYOUT.courtY + LAYOUT.courtH + 52);
  ctx.restore();
}

// ---- screens -------------------------------------------------------------------
function drawTitle(ctx, game) {
  ctx.save();
  ctx.fillStyle = 'rgba(8,16,10,0.72)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  // Ember particles drifting up.
  if (fx.embers.length === 0) {
    const rng = makeRng(game.seed * 7 + 3);
    for (let i = 0; i < 60; i += 1) {
      fx.embers.push({
        x: rng() * VIEW.width,
        y: rng() * VIEW.height,
        r: 1 + rng() * 2.5,
        v: 12 + rng() * 26,
        sway: rng() * Math.PI * 2,
      });
    }
  }
  for (const e of fx.embers) {
    const y = ((e.y - fx.time * e.v) % VIEW.height + VIEW.height) % VIEW.height;
    const x = e.x + Math.sin(fx.time * 0.8 + e.sway) * 14;
    ctx.beginPath();
    ctx.arc(x, y, e.r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,159,46,0.75)';
    ctx.fill();
  }
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.gold;
  ctx.font = 'bold 88px Georgia, serif';
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 24;
  ctx.fillText('EMBER COURT', VIEW.width / 2, 210);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffe9b0';
  ctx.font = 'italic 26px Georgia, serif';
  ctx.fillText('A duel of suits, embers and nerve', VIEW.width / 2, 258);
  // The four suits, big and unmistakable.
  const suits = Object.keys(SUITS);
  suits.forEach((key, i) => {
    const x = VIEW.width / 2 + (i - 1.5) * 130;
    drawGlyph(ctx, SUITS[key].glyph, x, 330, 64, SUITS[key].color);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.fillText(SUITS[key].name.toUpperCase(), x, 380);
  });
  ctx.fillStyle = '#e8e2cf';
  ctx.font = '19px system-ui, sans-serif';
  const rules = [
    'Play cards with embers. Each card strikes for its value.',
    'Flame beats Thorn, Thorn beats Tide, Tide beats Flame — a winning suit strikes +2.',
    'Two cards of one suit in a turn resonate for +2. Star is wild.',
    'Reduce the Courtier to 0 life before they do the same to you.',
  ];
  rules.forEach((line, i) => ctx.fillText(line, VIEW.width / 2, 440 + i * 32));
  const pulse = 0.65 + 0.35 * Math.sin(fx.time * 3);
  ctx.fillStyle = `rgba(255,233,176,${pulse})`;
  ctx.font = 'bold 24px system-ui, sans-serif';
  ctx.fillText('Press Enter or click to take your seat', VIEW.width / 2, 610);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillText('Click a card to play it · 1–5 play from your hand · Space ends your turn · R restarts · M mutes', VIEW.width / 2, 660);
  ctx.restore();
}

function drawEndScreen(ctx, game) {
  const won = game.winner === 'you';
  ctx.save();
  ctx.fillStyle = won ? 'rgba(20,40,10,0.78)' : 'rgba(40,10,10,0.78)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  // Confetti on a win.
  if (won) {
    for (const c of fx.confetti) {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.rot);
      ctx.fillStyle = c.color;
      ctx.fillRect(-5, -3, 10, 6);
      ctx.restore();
    }
  }
  ctx.textAlign = 'center';
  ctx.fillStyle = won ? COLORS.gold : '#ff8a80';
  ctx.font = 'bold 84px Georgia, serif';
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 24;
  ctx.fillText(won ? 'VICTORY' : 'DEFEAT', VIEW.width / 2, 300);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#fff';
  ctx.font = 'italic 28px Georgia, serif';
  ctx.fillText(
    won ? 'The Ember Court is yours — the throne is warm.' : 'The Courtier keeps the throne. Demand a rematch.',
    VIEW.width / 2,
    360,
  );
  ctx.font = '22px system-ui, sans-serif';
  ctx.fillStyle = '#ffe9b0';
  ctx.fillText(
    `Final score — You ${game.you.crowns} crowns · Courtier ${game.foe.crowns} crowns · ${game.turn} turns`,
    VIEW.width / 2,
    420,
  );
  ctx.fillText(`Life — You ${game.you.life} · Courtier ${game.foe.life}`, VIEW.width / 2, 458);
  const pulse = 0.65 + 0.35 * Math.sin(fx.time * 3);
  ctx.fillStyle = `rgba(255,255,255,${pulse})`;
  ctx.font = 'bold 24px system-ui, sans-serif';
  ctx.fillText('Press R or click to play again', VIEW.width / 2, 540);
  ctx.restore();
}

// ---- effects ---------------------------------------------------------------------
export function queueEvent(game, event, fromRect) {
  if (event.type === 'play') {
    const to = event.byAi ? courtRects().foe : courtRects().you;
    fx.flying.push({
      card: event.card,
      byAi: event.byAi,
      from: fromRect || { x: 640, y: 700, w: 112, h: 152 },
      to: { x: to.x, y: to.y + 16, w: to.w, h: to.h },
      t: 0,
      dur: 0.45,
    });
    const target = event.byAi
      ? { x: 144, y: 30 }
      : { x: VIEW.width - 144, y: 30 };
    fx.floats.push({
      x: target.x,
      y: target.y + 20,
      text: `-${event.damage}`,
      color: event.byAi ? '#ff7b72' : '#7ee787',
      t: 0,
    });
    if (event.damage >= 8) fx.shake = 0.35;
  } else if (event.type === 'win') {
    const rng = makeRng(game.seed * 13 + 5);
    const palette = ['#e8b64c', '#e2482e', '#2b7fd4', '#3da35a', '#c98a12', '#f7f1de'];
    for (let i = 0; i < 140; i += 1) {
      fx.confetti.push({
        x: 100 + rng() * (VIEW.width - 200),
        y: -20 - rng() * 300,
        vx: (rng() - 0.5) * 60,
        vy: 90 + rng() * 140,
        color: palette[i % palette.length],
        rot: rng() * Math.PI * 2,
        vr: (rng() - 0.5) * 6,
        t: 0,
      });
    }
  }
}

export function clearFx() {
  fx.flying = [];
  fx.floats = [];
  fx.confetti = [];
  fx.shake = 0;
}

function updateFx(dt) {
  fx.time += dt;
  if (fx.shake > 0) fx.shake = Math.max(0, fx.shake - dt);
  fx.flying = fx.flying.filter((f) => (f.t += dt) < f.dur);
  fx.floats = fx.floats.filter((f) => (f.t += dt) < 1.1);
  for (const c of fx.confetti) {
    c.t += dt;
    c.x += c.vx * dt;
    c.y += c.vy * dt;
    c.rot += c.vr * dt;
    if (c.y > VIEW.height + 20) c.y = -20;
  }
}

function easeOut(t) {
  return 1 - (1 - t) * (1 - t);
}

// ---- the frame --------------------------------------------------------------------
export function render(ctx, game, ui, dt) {
  updateFx(dt);
  ctx.save();
  if (fx.shake > 0) {
    const m = fx.shake * 22;
    ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m);
  }
  // Felt table with a gold rail.
  const grad = ctx.createRadialGradient(640, 380, 120, 640, 400, 760);
  grad.addColorStop(0, COLORS.feltLight);
  grad.addColorStop(1, COLORS.feltDark);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.strokeStyle = COLORS.railLight;
  ctx.lineWidth = 6;
  roundRect(ctx, 10, 10, VIEW.width - 20, VIEW.height - 20, 26);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(122,90,34,0.6)';
  ctx.lineWidth = 2;
  roundRect(ctx, 22, 22, VIEW.width - 44, VIEW.height - 44, 20);
  ctx.stroke();

  if (game.phase === 'title') {
    drawTitle(ctx, game);
    ctx.restore();
    return;
  }

  drawHud(ctx, game);
  drawCourt(ctx, game);
  drawDecks(ctx, game);
  drawLog(ctx, game);
  drawSuitGuide(ctx);

  // The Courtier's hand: face down, counted, readable at a glance.
  for (const r of oppHandRects(game)) drawCardBack(ctx, r.x, r.y, r.w, r.h);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`The Courtier holds ${game.foe.hand.length} cards`, VIEW.width / 2, 76);

  // Your hand, with the hovered card lifted and unaffordable cards dimmed.
  const rects = playerHandRects(game);
  for (const r of rects) {
    const affordable = game.phase === 'player' && r.card.cost <= game.you.embers;
    drawCard(ctx, r.card, r.x, r.y, r.w, r.h, {
      hover: ui.hoverCardId === r.card.id,
      dim: !affordable && game.phase === 'player',
    });
  }
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Your hand — click a card to play it', VIEW.width / 2, 606);

  // Embers and the End Turn button.
  drawEmbers(ctx, game);
  drawButton(ctx, LAYOUT.endTurn, 'End Turn', game.phase === 'player');
  // Mute button (plain text: no emoji font is guaranteed in headless runs).
  drawButton(ctx, LAYOUT.mute, ui.muted ? 'MUTED' : 'SOUND', true);

  // Flying cards on top of everything.
  for (const f of fx.flying) {
    const t = easeOut(Math.min(1, f.t / f.dur));
    const x = f.from.x + (f.to.x - f.from.x) * t;
    const y = f.from.y + (f.to.y - f.from.y) * t;
    const w = f.from.w + (f.to.w - f.from.w) * t;
    const h = f.from.h + (f.to.h - f.from.h) * t;
    drawCard(ctx, f.card, x, y, w, h);
  }
  // Floating damage numbers.
  for (const fl of fx.floats) {
    ctx.save();
    ctx.globalAlpha = 1 - fl.t / 1.1;
    ctx.fillStyle = fl.color;
    ctx.font = 'bold 30px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText(fl.text, fl.x, fl.y - fl.t * 46);
    ctx.restore();
  }

  if (game.phase === 'over') drawEndScreen(ctx, game);
  ctx.restore();
}
