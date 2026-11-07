import { newGame } from '../js/sim/setup.js';
import { tick, primeState } from '../js/sim/engine.js';
import { campaignAction } from '../js/sim/politics.js';
const camp = process.argv[2] === 'camp';
let wins = 0;
for (let seed = 1; seed <= 12; seed++) {
  const S = newGame({ seed }); primeState(S);
  for (let d = 0; d < 46; d++) { if (camp) campaignAction(S, d % 7 === 0 ? 'ads' : d === 20 ? 'debate' : 'rally', ['Plumeria','Port Wren','Featherfall'][d%3]); tick(S); S.pending = S.pending.filter(p => p.type !== 'event'); }
  const r = S.pol.lastResult; const f = r.runoff || r.round1;
  if (r.won) wins++;
  console.log(seed, r.won, Object.entries(f.share).map(([k,v])=>k+':'+v.toFixed(1)).join(' '), r.runoff ? 'runoff' : '');
}
console.log('wins', wins);
