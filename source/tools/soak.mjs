import { newGame } from '../js/sim/setup.js';
import { tick, primeState } from '../js/sim/engine.js';
import { eventView, resolveEvent } from '../js/sim/events.js';
import { campaignAction } from '../js/sim/politics.js';
import { serialize, deserialize } from '../js/sim/save.js';
const S = newGame({ seed: Number(process.argv[2] || 42), birdId: 'abbas', partyId: process.argv[3] || 'unity' });
primeState(S);
const years = 10;
let ev = 0;
for (let d = 0; d < 365 * years; d++) {
  if (S.pol.campaign && d % 2 === 0) campaignAction(S, d % 6 === 0 ? 'ads' : 'rally', 'Plumeria');
  tick(S);
  while (S.pending.length) { const p = S.pending[0]; if (p.type === 'event') { const v = eventView(S, p); ev++; resolveEvent(S, p, v.options[0].id); } else S.pending.shift(); }
  if (S.pol.phase === 'gameover') { console.log('GAME OVER day', S.day, S.pol.gameOverReason); break; }
  if (d % 365 === 0 || d === 50) {
    const e = S.countries[0].econ;
    console.log(`d${S.day} ${S.pol.phase} appr ${S.pol.approval.toFixed(1)} g ${e.growth.toFixed(2)} inf ${e.inflation.toFixed(2)} u ${e.unemployment.toFixed(2)} debt ${(e.debt/e.gdp*100).toFixed(0)}% def ${(e.deficit/e.gdp*100).toFixed(1)} rate ${e.rate.toFixed(2)} fx ${e.currency.toFixed(0)} hap ${S.kpis.happiness.toFixed(1)} cap ${S.pol.capital.toFixed(0)} seats ${Object.values(S.parties).map(p=>p.id+':'+p.seats).join(' ')} wars ${S.wars.length}`);
  }
}
console.log('events', ev, 'news', S.news.length, 'save KB', (serialize(S).length/1024).toFixed(0));
deserialize(serialize(S));
console.log(S.news.slice(0,8).map(n=>n.headline).join('\n'));
for (const c of S.countries) console.log(c.short, c.econ.growth.toFixed(2), c.econ.inflation.toFixed(2), c.econ.unemployment.toFixed(1), (c.econ.debt/c.econ.gdp*100).toFixed(0), c.leader?.name||'', S.rel[0][c.idx]);
console.log(S.pol.lastResult && JSON.stringify(S.pol.lastResult.round1?.share||S.pol.lastResult.share));
