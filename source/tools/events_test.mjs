import { newGame } from '../js/sim/setup.js';
import { tick, primeState } from '../js/sim/engine.js';
import { EVENTS, fireEvent, eventView, resolveEvent } from '../js/sim/events.js';
import { campaignAction } from '../js/sim/politics.js';
import * as gov from '../js/sim/government.js';
import * as dip from '../js/sim/diplomacy.js';
import * as mil from '../js/sim/military.js';
import * as pol from '../js/sim/politics.js';
import { LAWS, ORDERS, RESEARCH } from '../js/sim/data.js';
import { serialize, deserialize } from '../js/sim/save.js';
import { segments } from '../js/sim/citizens.js';
function base() { const S = newGame({ seed: 11 }); primeState(S); for (let d = 0; d < 50; d++) { campaignAction(S, 'rally', 'Plumeria'); tick(S); S.pending = []; } return S; }
let errors = 0;
for (const id of Object.keys(EVENTS)) {
  if (id === 'investigation') continue;
  const optsCount = (() => { const S = base(); try { if (id === 'protest') { S.pending.push({ type: 'event', id, data: { city: 'Plumeria', cause: 'housing' } }); } else if (id === 'bordercrisis') S.pending.push({ type: 'event', id, data: { dispute: 'featherridge' } }); else if (EVENTS[id].view && !EVENTS[id].prep && !['crash','outbreak','refugees','impeachment','summit'].includes(id)) return 0; else fireEvent(S, id); const p = S.pending.find(x => x.type==='event'); return p ? eventView(S, p).options.length : 0; } catch (e) { console.log('VIEW ERR', id, e.message); errors++; return 0; } })();
  for (let o = 0; o < Math.max(1, optsCount); o++) {
    const S = base();
    try {
      if (id === 'protest') { S.pol.protest = { city: 'Plumeria', intensity: .3 }; S.pending.push({ type: 'event', id, data: { city: 'Plumeria', cause: 'housing' } }); }
      else if (id === 'bordercrisis') S.pending.push({ type: 'event', id, data: { dispute: 'featherridge' } });
      else fireEvent(S, id);
      const p = S.pending.find(x => x.type==='event');
      if (p) { const v = eventView(S, p); resolveEvent(S, p, v.options[o].id); }
      for (let d = 0; d < 60; d++) { tick(S); S.pending = S.pending.filter(x => x.type !== 'event'); }
    } catch (e) { console.log('ERR', id, o, e.stack.split('\n').slice(0,3).join(' | ')); errors++; }
  }
}
// exercise all player actions
const S = base();
const tryA = (name, f) => { try { const r = f(); } catch (e) { console.log('ACT ERR', name, e.stack.split('\n').slice(0,2).join(' | ')); errors++; } };
S.pol.capital = 100;
for (const L of LAWS) tryA('law '+L.id, () => pol.proposeBill(S, L.id));
for (const O of ORDERS) tryA('order '+O.id, () => { S.pol.capital = 100; gov.signOrder(S, O.id); });
for (const a of Object.keys(dip.DIPLO_ACTIONS)) for (let c = 1; c < 8; c++) tryA('dip '+a, () => { S.pol.capital = 100; dip.diploAction(S, a, c, 'trade'); });
tryA('research', () => mil.startResearch(S, 'drones')); tryA('ex', () => mil.militaryExercise(S, 1)); tryA('deploy', () => mil.toggleDeploy(S)); tryA('mob', () => mil.toggleMobilize(S));
tryA('emergency', () => gov.declareEmergency(S, 'security'));
tryA('press', () => { const qs = gov.buildPressConference(S); const rs = qs.map(q => gov.answerPress(S, q, 'confident')); gov.finishPress(S, rs); });
tryA('speech', () => gov.giveSpeech(S, 'economy', 'inspiring'));
tryA('budget', () => pol.proposeBudget(S, { ...S.countries[0].budget, health: 6 }, { ...S.countries[0].taxes, income: 30 }));
tryA('invite', () => pol.inviteToCoalition(S, 'canopy'));
tryA('fire', () => gov.fire(S, 'finance')); tryA('appoint', () => gov.appoint(S, 'finance', 'npc0'));
S.pol.capital = 100; tryA('war', () => mil.playerDeclareWar(S, 1));
for (let d = 0; d < 400; d++) { tryA('tick', () => tick(S)); S.pending = S.pending.filter(x => x.type !== 'event'); for (const b of S.pol.bills.filter(b=>b.stage==='desk')) tryA('veto', () => pol.vetoBill(S, b)); }
tryA('seg', () => segments(S));
tryA('save', () => deserialize(serialize(S)));
console.log('wars', S.wars.length, 'laws', S.pol.activeLaws.length, 'phase', S.pol.phase, 'errors', errors);
