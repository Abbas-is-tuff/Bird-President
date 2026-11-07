import { newGame } from '../js/sim/setup.js';
import { tick, primeState } from '../js/sim/engine.js';
import { eventView, resolveEvent } from '../js/sim/events.js';
import { campaignAction } from '../js/sim/politics.js';
import { playerDeclareWar, warOrder } from '../js/sim/military.js';
import { warBetween } from '../js/sim/diplomacy.js';
const active = process.argv[2] === 'active', target = +(process.argv[3] || 1);
let wins = 0, losses = 0, other = 0;
for (let seed = 1; seed <= 12; seed++) {
  const S = newGame({ seed, difficulty: process.argv[4] || 'normal' }); primeState(S);
  for (let d = 0; d < 50; d++) { campaignAction(S, 'rally', 'Plumeria'); tick(S); S.pending = []; }
  if (S.pol.phase !== 'governing') { other++; continue; }
  S.pol.capital = 100; playerDeclareWar(S, target);
  let res = 'ongoing';
  for (let d = 0; d < 730 && warBetween(S, 0, target); d++) {
    if (active) { for (const o of ['allies', 'warbudget', 'offensive', 'airstrike']) warOrder(S, target, o); }
    tick(S);
    for (const p of [...S.pending]) { if (p.type === 'event') resolveEvent(S, p, eventView(S, p).options[0].id); else S.pending.splice(S.pending.indexOf(p), 1); }
  }
  const d = S.disputes.find(x => x.id === 'featherridge'); global.days = (global.days || 0) + S.day;
  if (d.holder === 0) wins++; else if (d.holder === target) losses++; else other++;
}
console.log('avg end day', (global.days / 12).toFixed(0)); console.log(active ? 'active' : 'passive', 'target', target, 'wins', wins, 'losses', losses, 'other', other);
