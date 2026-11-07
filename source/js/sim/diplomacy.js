// International relations: relations matrix, treaties, sanctions, embassies, disputes, wars and AI leaders.
import { clamp, chance, rand, pick, randInt, gauss, fmtMoney } from './util.js';
import { LEADER_FIRST, LEADER_LAST } from './data.js';
import { news, toast } from './news.js';
import { milPower } from './military.js';
import { isGoverning, deptEfficiency } from './government.js';

export const TREATY_NAMES = { trade: 'Trade agreement', alliance: 'Defense alliance', nonaggression: 'Non-aggression pact' };

export const rel = (S, a, b) => S.rel[a][b];
export function addRel(S, a, b, d) { const v = clamp(S.rel[a][b] + d, -100, 100); S.rel[a][b] = S.rel[b][a] = v; }
export const hasTreaty = (S, type, a, b) => S.treaties.some((t) => t.type === type && ((t.a === a && t.b === b) || (t.a === b && t.b === a)));
export const treatiesOf = (S, i, type) => S.treaties.filter((t) => (t.a === i || t.b === i) && (!type || t.type === type));
export const sanctionsOn = (S, i) => S.sanctions.filter((s) => s.to === i);
export const isSanctioning = (S, a, b) => S.sanctions.some((s) => s.from === a && s.to === b);
export const atWar = (S, i) => S.wars.filter((w) => w.a === i || w.b === i);
export const warBetween = (S, a, b) => S.wars.find((w) => (w.a === a && w.b === b) || (w.a === b && w.b === a));
export const allies = (S, i) => treatiesOf(S, i, 'alliance').map((t) => (t.a === i ? t.b : t.a));

export function relLabel(v) {
  if (v >= 70) return 'Close allies'; if (v >= 40) return 'Friendly'; if (v >= 10) return 'Cordial';
  if (v > -10) return 'Neutral'; if (v > -40) return 'Strained'; if (v > -70) return 'Hostile'; return 'Enemies';
}

export function signTreaty(S, type, a, b) {
  if (hasTreaty(S, type, a, b)) return;
  S.treaties.push({ type, a, b, since: S.day });
  addRel(S, a, b, type === 'alliance' ? 15 : 8);
  const A = S.countries[a], B = S.countries[b];
  news(S, 'Diplomacy', `${A.short} and ${B.short} sign ${TREATY_NAMES[type].toLowerCase()}`, `Leaders of both nations hailed "a new chapter" in relations.`, { intl: a !== 0 && b !== 0, imp: a === 0 || b === 0 ? 2 : 1, tone: 1 });
}
export function breakTreaty(S, type, a, b) {
  S.treaties = S.treaties.filter((t) => !(t.type === type && ((t.a === a && t.b === b) || (t.a === b && t.b === a))));
  addRel(S, a, b, type === 'alliance' ? -30 : -15);
  news(S, 'Diplomacy', `${S.countries[a].short} withdraws from ${TREATY_NAMES[type].toLowerCase()} with ${S.countries[b].short}`, 'The move was condemned as a betrayal.', { intl: a !== 0, imp: a === 0 || b === 0 ? 2 : 1, tone: -1 });
}

// AI acceptance probability for a proposal from `from` to `to`.
export function acceptChance(S, type, from, to) {
  const T = S.countries[to], r = rel(S, from, to), L = T.leader;
  if (!L) return 0;
  if (warBetween(S, from, to)) return 0;
  const sharedRival = S.countries.some((c, k) => k !== from && k !== to && rel(S, to, k) < -40 && rel(S, from, k) < -20);
  let p = 0;
  if (type === 'trade') p = 0.25 + r / 90 + L.trade * 0.45 - (isSanctioning(S, from, to) ? 1 : 0);
  if (type === 'alliance') p = -0.35 + r / 80 + (sharedRival ? 0.35 : 0) + L.aggression * 0.1;
  if (type === 'nonaggression') p = 0.2 + r / 120 + (milPower(S.countries[from]) > milPower(T) ? 0.2 : 0) - L.aggression * 0.3;
  if (from === 0) p += (deptEfficiency(S, 'foreign') - 1) * 0.6 + (S.embassy[from][to] ? 0.05 : -0.2);
  return clamp(p, 0, 0.97);
}

// ---- Player diplomatic actions ----
export const DIPLO_ACTIONS = {
  envoy: { name: 'Send diplomatic envoy', pc: 3, desc: 'Improve relations (+6 to +12).' },
  aid: { name: 'Offer aid package', pc: 2, desc: 'Costs 0.1% of GDP. Large relations boost.' },
  trade: { name: 'Propose trade agreement', pc: 6, desc: 'Boosts exports for both countries.' },
  alliance: { name: 'Propose defense alliance', pc: 10, desc: 'Mutual defence. Requires strong relations.' },
  nonaggression: { name: 'Propose non-aggression pact', pc: 5, desc: 'Reduces risk of conflict.' },
  summit: { name: 'Invite leader to state visit', pc: 6, desc: 'Big relations boost if relations are already positive.' },
  denounce: { name: 'Publicly denounce', pc: 2, desc: 'Domestic boost with hawks, relations collapse.' },
  sanction: { name: 'Impose sanctions', pc: 8, desc: 'Hurts their economy (and your exports).' },
  lift: { name: 'Lift sanctions', pc: 3, desc: 'Ends your sanctions.' },
  embassy: { name: 'Open / close embassy', pc: 4, desc: 'Embassies are required for effective diplomacy.' },
  cancel: { name: 'Cancel a treaty', pc: 5, desc: 'Withdraw from an agreement.' },
  negotiate: { name: 'Negotiate border dispute', pc: 8, desc: 'Lower tension over a disputed region.' },
  ceasefire: { name: 'Propose ceasefire', pc: 6, desc: 'End a war on current terms.' },
};

export function diploAction(S, act, to, arg) {
  if (!isGoverning(S)) return { ok: false, msg: 'Only the President conducts foreign policy.' };
  const A = DIPLO_ACTIONS[act], pol = S.pol, T = S.countries[to], me = 0;
  if (pol.capital < A.pc) return { ok: false, msg: `Needs ${A.pc} political capital.` };
  const fEff = deptEfficiency(S, 'foreign');
  const res = (ok, msg) => { if (ok) pol.capital -= A.pc; return { ok, msg }; };
  const cool = S.flags['dip_' + act + '_' + to] || 0;
  if (['envoy', 'summit', 'aid'].includes(act) && cool > S.day) return { ok: false, msg: `Too soon — try again after ${cool - S.day} days.` };
  switch (act) {
    case 'envoy': {
      if (!S.embassy[me][to]) return { ok: false, msg: 'Open an embassy first.' };
      const d = Math.round((6 + rand(S) * 6) * fEff); addRel(S, me, to, d); S.flags['dip_envoy_' + to] = S.day + 30;
      return res(true, `Relations with ${T.short} improved by ${d}.`);
    }
    case 'aid': {
      const cost = S.countries[0].econ.gdp * 0.001; S.countries[0].econ.debt += cost; T.econ.shock += 0.3;
      addRel(S, me, to, Math.round(12 * fEff)); S.flags['dip_aid_' + to] = S.day + 60;
      news(S, 'Diplomacy', `${S.countries[0].short} sends ${fmtMoney(cost)} aid package to ${T.short}`, `${T.leader.name} thanked the President for the "generous gesture".`, { tone: 1 });
      return res(true, `Aid sent. Relations +${Math.round(12 * fEff)}.`);
    }
    case 'trade': case 'alliance': case 'nonaggression': {
      if (hasTreaty(S, act, me, to)) return { ok: false, msg: 'Treaty already exists.' };
      const p = acceptChance(S, act, me, to);
      if (chance(S, p)) { signTreaty(S, act, me, to); return res(true, `${T.leader.name} accepted!`); }
      addRel(S, me, to, -2);
      news(S, 'Diplomacy', `${T.short} rejects ${S.countries[0].adj} offer of ${TREATY_NAMES[act].toLowerCase()}`, `Officials in ${T.capital} said the time "was not right".`);
      return res(true, `${T.leader.name} rejected the proposal.`);
    }
    case 'summit': {
      const r = rel(S, me, to);
      const d = Math.round((r > 0 ? 14 : 4) * fEff); addRel(S, me, to, d); pol.mood += r > 20 ? 0.008 : 0;
      S.flags['dip_summit_' + to] = S.day + 90;
      news(S, 'Diplomacy', `${T.leader.name} arrives in ${S.countries[0].capital} for state visit`, `Talks focused on trade and regional security. Relations improved by ${d}.`, { imp: 2, tone: 1 });
      return res(true, `State visit held. Relations +${d}.`);
    }
    case 'denounce': {
      addRel(S, me, to, -18); pol.mood += S.player.partyId === 'talon' || S.player.partyId === 'nest' ? 0.01 : 0.002;
      news(S, 'Diplomacy', `President condemns ${T.short} in fiery statement`, `${T.capital} summoned the ${S.countries[0].adj} ambassador in response.`, { imp: 2 });
      return res(true, 'Statement delivered.');
    }
    case 'sanction': {
      if (isSanctioning(S, me, to)) return { ok: false, msg: 'Already sanctioning.' };
      S.sanctions.push({ from: me, to, since: S.day }); addRel(S, me, to, -25);
      for (const t of ['trade']) if (hasTreaty(S, t, me, to)) breakTreaty(S, t, me, to);
      news(S, 'Diplomacy', `${S.countries[0].short} imposes sanctions on ${T.short}`, `Asset freezes and export bans take effect. Economists warn ${S.countries[0].adj} exporters will also feel the pain.`, { imp: 3 });
      return res(true, 'Sanctions imposed.');
    }
    case 'lift': {
      if (!isSanctioning(S, me, to)) return { ok: false, msg: 'No sanctions in place.' };
      S.sanctions = S.sanctions.filter((s) => !(s.from === me && s.to === to)); addRel(S, me, to, 10);
      news(S, 'Diplomacy', `${S.countries[0].short} lifts sanctions on ${T.short}`, 'The move is seen as a thaw in relations.', { imp: 2 });
      return res(true, 'Sanctions lifted.');
    }
    case 'embassy': {
      const open = S.embassy[me][to];
      S.embassy[me][to] = S.embassy[to][me] = !open; addRel(S, me, to, open ? -20 : 6);
      news(S, 'Diplomacy', open ? `${S.countries[0].short} closes embassy in ${T.capital}` : `${S.countries[0].short} opens embassy in ${T.capital}`, open ? 'Diplomats have been recalled.' : 'Ambassador presents credentials.', { imp: 2 });
      return res(true, open ? 'Embassy closed.' : 'Embassy opened.');
    }
    case 'cancel': {
      if (!hasTreaty(S, arg, me, to)) return { ok: false, msg: 'No such treaty.' };
      breakTreaty(S, arg, me, to); return res(true, 'Treaty cancelled.');
    }
    case 'negotiate': {
      const d = S.disputes.find((x) => !x.resolved && ((x.a === me && x.b === to) || (x.b === me && x.a === to)));
      if (!d) return { ok: false, msg: `No dispute with ${T.short}.` };
      const p = clamp(0.35 + rel(S, me, to) / 150 + (fEff - 1) - T.leader.aggression * 0.3, 0.05, 0.9);
      if (chance(S, p)) { d.tension = Math.max(0, d.tension - 25); addRel(S, me, to, 6); if (d.tension < 8 && chance(S, 0.4)) { d.resolved = true; news(S, 'Diplomacy', `Historic deal settles ${d.name} dispute`, `Both nations agreed to a joint administration framework.`, { imp: 3, tone: 1 }); pol.mood += 0.02; } else news(S, 'Diplomacy', `Talks ease tensions over ${d.name}`, `Negotiators agreed on a de-escalation roadmap.`, { imp: 2, tone: 1 }); return res(true, 'Talks succeeded. Tension −25.'); }
      d.tension = clamp(d.tension + 5, 0, 100);
      return res(true, 'Talks collapsed. Tension +5.');
    }
    case 'ceasefire': {
      const w = warBetween(S, me, to); if (!w) return { ok: false, msg: 'Not at war.' };
      const myScore = w.a === me ? w.score : -w.score;
      const p = clamp(0.3 + w.weariness / 100 - myScore / -150 - T.leader.aggression * 0.2 + (myScore > 0 ? 0.25 : 0), 0.05, 0.95);
      if (chance(S, p)) { endWar(S, w, 'ceasefire'); return res(true, 'Ceasefire agreed.'); }
      return res(true, `${T.leader.name} rejected the ceasefire.`);
    }
  }
  return { ok: false, msg: 'Unknown action.' };
}

// ---- Proposals from AI to the player ----
export function respondProposal(S, idx, accept) {
  const p = S.proposals[idx]; if (!p) return;
  S.proposals.splice(idx, 1);
  const T = S.countries[p.from];
  if (accept) {
    if (p.type === 'demand') { addRel(S, 0, p.from, 10); S.pol.mood -= 0.015; S.countries[0].econ.debt += p.amount; news(S, 'Diplomacy', `${S.countries[0].short} yields to ${T.short} demand`, `Critics called it a humiliation.`, { imp: 2, tone: -1 }); }
    else signTreaty(S, p.type, p.from, 0);
  } else {
    addRel(S, 0, p.from, p.type === 'demand' ? -8 : -4);
    if (p.type === 'demand') { const d = S.disputes.find((x) => !x.resolved && (x.a === p.from || x.b === p.from) && (x.a === 0 || x.b === 0)); if (d) d.tension = clamp(d.tension + 12, 0, 100); S.pol.mood += 0.008; }
  }
}

// ---- Wars ----
export function declareWar(S, a, b, reason = '') {
  if (warBetween(S, a, b)) return;
  for (const t of ['trade', 'alliance', 'nonaggression']) if (hasTreaty(S, t, a, b)) S.treaties = S.treaties.filter((x) => !(x.type === t && ((x.a === a && x.b === b) || (x.a === b && x.b === a))));
  addRel(S, a, b, -60);
  const w = { a, b, since: S.day, score: 0, weariness: 0, casualties: 0, reason };
  S.wars.push(w);
  const A = S.countries[a], B = S.countries[b];
  A.mil.mobilized = true; B.mil.mobilized = true;
  // world reaction
  for (let k = 0; k < S.countries.length; k++) if (k !== a && k !== b) addRel(S, k, a, -12);
  news(S, 'War', `WAR: ${A.short} launches military operations against ${B.short}`, `${reason || 'Border clashes escalated into open conflict.'} Allies of both nations are under pressure to respond.`, { imp: 3, tone: -1, intl: a !== 0 && b !== 0 });
  // allies join diplomatically: allied countries sour relations with aggressor
  for (const al of allies(S, b)) addRel(S, al, a, -25);
  if (a === 0 || b === 0) { S.pol.mood += a === 0 ? 0.03 : 0.06; S.flags.rally = S.day; }
  return w;
}

export function endWar(S, w, how) {
  S.wars = S.wars.filter((x) => x !== w);
  const A = S.countries[w.a], B = S.countries[w.b];
  A.mil.mobilized = false; B.mil.mobilized = false;
  const d = S.disputes.find((x) => !x.resolved && ((x.a === w.a && x.b === w.b) || (x.a === w.b && x.b === w.a)));
  let txt = '';
  if (how === 'victory' || how === 'defeat') {
    const winner = w.score > 0 ? w.a : w.b, loser = winner === w.a ? w.b : w.a;
    if (d) { d.holder = winner; d.resolved = true; d.tension = 0; txt = `${S.countries[winner].short} takes control of ${d.name}. `; }
    S.countries[loser].econ.debt += S.countries[loser].econ.gdp * 0.03;
    S.countries[loser].stability -= 15;
    news(S, 'War', `${S.countries[winner].short} victorious; ${S.countries[loser].short} accepts terms`, `${txt}Casualties are estimated at ${Math.round(w.casualties).toLocaleString()}.`, { imp: 3, tone: winner === 0 ? 1 : -1 });
    if (winner === 0) S.pol.mood += 0.08; else if (loser === 0) S.pol.mood -= 0.12;
  } else {
    if (d) d.tension = 45;
    news(S, 'War', `Ceasefire between ${A.short} and ${B.short} takes effect`, `Guns fall silent after ${Math.round((S.day - w.since) / 7)} weeks. Casualties: ${Math.round(w.casualties).toLocaleString()}.`, { imp: 3 });
    if (w.a === 0 || w.b === 0) S.pol.mood += 0.02;
  }
  addRel(S, w.a, w.b, 25);
}

export function weeklyWars(S) {
  for (const w of [...S.wars]) {
    const pa = sidePower(S, w, 'a'), pb = sidePower(S, w, 'b');
    const push = (w.push || 0) * (w.a === 0 ? 1 : -1);
    const delta = (pa - pb) / (pa + pb) * 7 + push + gauss(S) * 2.5;
    w.push = (w.push || 0) * 0.55;
    w.score = clamp(w.score + delta, -100, 100);
    w.weariness = clamp(w.weariness + 1.6, 0, 100);
    const cas = (pa + pb) * (0.6 + rand(S));
    w.casualties += cas;
    for (const i of [w.a, w.b]) { const m = S.countries[i].mil; m.ground *= 0.995; m.air *= 0.996; m.readiness = clamp(m.readiness - 0.5, 20, 100); }
    if (w.a === 0 || w.b === 0) { S.pol.mood -= 0.002 + w.weariness / 20000; }
    const mine = w.a === 0 ? w.score : w.b === 0 ? -w.score : null;
    if (mine != null && mine >= WIN_SCORE) endWar(S, w, w.a === 0 ? 'victory' : 'defeat');
    else if (Math.abs(w.score) >= 99) endWar(S, w, w.score > 0 ? 'victory' : 'defeat');
    else if (mine != null && mine > ({ easy: 20, normal: 30, hard: 48 }[S.player.difficulty] || 30) && w.weariness > 12 && !S.pending.some((p) => p.id === 'peaceoffer') && (w.offerCd || 0) < S.day && chance(S, 0.12 + mine / 250)) {
      w.offerCd = S.day + 45;
      S.pending.push({ type: 'event', id: 'peaceoffer', data: { enemy: w.a === 0 ? w.b : w.a } });
    }
    else if (w.a !== 0 && w.b !== 0 && w.weariness > 40 && chance(S, 0.05)) endWar(S, w, 'ceasefire');
    else if (S.day % 28 === 0 && (w.a === 0 || w.b === 0)) {
      const me = w.a === 0 ? w.score : -w.score;
      news(S, 'War', me > 0 ? `${S.countries[0].adj} forces advance on all fronts` : `${S.countries[0].adj} forces under heavy pressure`, `Military analysts rate the campaign ${me > 30 ? 'decisively in our favour' : me > 0 ? 'slightly in our favour' : me > -30 ? 'finely balanced' : 'going badly'}.`, { tone: me > 0 ? 1 : -1 });
    }
  }
}

// Win threshold for the player's side (AI-vs-AI wars still need a total victory).
export const WIN_SCORE = 70;
const DIFF_BONUS = { easy: 2.2, normal: 1.6, hard: 1.15 };
// Fighting strength of one side: its own forces, defensive bonus, allies that joined, and for the
// player a doctrine/home-front bonus that depends on difficulty and the Defense Minister.
export function sidePower(S, w, side) {
  const i = w[side], other = side === 'a' ? w.b : w.a;
  let p = milPower(S.countries[i]);
  if (side === 'b') p *= 1.15; // defender's advantage
  if (i === 0) p *= DIFF_BONUS[S.player.difficulty] || 1.6;
  const joined = (side === 'a' ? w.alliesA : w.alliesB) || [];
  for (const k of joined) p += milPower(S.countries[k]) * 0.6;
  if (i !== 0) p *= 1 + allies(S, i).filter((k) => !joined.includes(k) && k !== other).length * 0.1;
  return p;
}
export const warSide = (w, i) => (w.a === i ? 'a' : 'b');

// ---- AI foreign policy (monthly) ----
function newLeaderFor(S, c) {
  const old = c.leader;
  c.leader = { name: (c.gov === 'monarchy' ? 'Queen ' : c.gov === 'autocracy' ? 'General ' : c.gov === 'federation' ? 'Chancellor ' : 'President ') + pick(S, LEADER_FIRST) + ' ' + pick(S, LEADER_LAST),
    aggression: clamp(old.aggression + gauss(S) * 0.25, 0.05, 0.95), trade: clamp(old.trade + gauss(S) * 0.2, 0.05, 0.95), econ: clamp(old.econ + gauss(S) * 0.4, -1, 1), social: clamp(old.social + gauss(S) * 0.35, -1, 1), charisma: randInt(S, 45, 85), termStart: S.day };
  return old;
}

export function monthlyDiplomacy(S) {
  const n = S.countries.length;
  // Relations drift toward an ideological baseline, embassies and trade help
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) {
    const A = S.countries[a], B = S.countries[b];
    const la = a === 0 ? { econ: S.pol.stance.econ, social: S.pol.stance.social, aggression: 0.3 } : A.leader;
    const lb = B.leader;
    let base = 25 - Math.hypot(la.econ - lb.econ, la.social - lb.social) * 22 - (la.aggression + lb.aggression) * 12;
    if (hasTreaty(S, 'trade', a, b)) base += 12; if (hasTreaty(S, 'alliance', a, b)) base += 25;
    if (!S.embassy[a][b]) base -= 15;
    if (isSanctioning(S, a, b) || isSanctioning(S, b, a)) base -= 30;
    const d = S.disputes.find((x) => !x.resolved && ((x.a === a && x.b === b) || (x.a === b && x.b === a)));
    if (d) base -= d.tension * 0.4;
    if (warBetween(S, a, b)) base = -90;
    addRel(S, a, b, (base - S.rel[a][b]) * 0.04);
  }
  // Dispute tension dynamics
  for (const d of S.disputes) {
    if (d.resolved) continue;
    const A = S.countries[d.a], B = S.countries[d.b];
    const agg = Math.max(A.leader ? A.leader.aggression : 0.25, B.leader ? B.leader.aggression : 0.25);
    const deter = d.a === 0 || d.b === 0 ? S.countries[0].mil.border / 200 + (S.countries[0].mil.deployed ? 0.15 : 0) : 0;
    d.tension = clamp(d.tension + (agg - 0.4 - deter) * 6 + gauss(S) * 2.5 - (rel(S, d.a, d.b) > 30 ? 2 : 0), 0, 100);
    if (d.tension > 70 && !warBetween(S, d.a, d.b) && S.day % 90 < 30 && (d.a === 0 || d.b === 0)) {
      if (!S.flags['crisis_' + d.id] || S.flags['crisis_' + d.id] < S.day - 120) { S.flags['crisis_' + d.id] = S.day; S.pending.push({ type: 'event', id: 'bordercrisis', data: { dispute: d.id } }); }
    }
    if (d.tension >= 96 && !warBetween(S, d.a, d.b)) {
      const aggressor = (A.leader?.aggression || 0.3) > (B.leader?.aggression || 0.3) ? d.a : d.b;
      const target = aggressor === d.a ? d.b : d.a;
      if (aggressor !== 0 && milPower(S.countries[aggressor]) > milPower(S.countries[target]) * 0.9 && chance(S, 0.35)) declareWar(S, aggressor, target, `Fighting erupted in the disputed ${d.name} region.`);
    }
  }
  // AI leaders act
  for (let i = 1; i < n; i++) {
    const C = S.countries[i], L = C.leader;
    if (atWar(S, i).length) continue;
    const r = rand(S);
    const j = randInt(S, 0, n - 1); if (j === i) continue;
    if (r < 0.25 && !hasTreaty(S, 'trade', i, j) && !warBetween(S, i, j)) {
      if (j === 0) { if (rel(S, i, 0) > 10 && chance(S, L.trade * 0.6) && !S.proposals.some((p) => p.from === i)) { S.proposals.push({ from: i, type: 'trade', day: S.day, expires: S.day + 30 }); toast(S, `${C.short} proposes a trade agreement`, 'Diplomacy'); } }
      else if (chance(S, acceptChance(S, 'trade', i, j) * 0.5)) signTreaty(S, 'trade', i, j);
    } else if (r < 0.33 && rel(S, i, j) > 55 && !hasTreaty(S, 'alliance', i, j)) {
      if (j === 0) { if (!S.proposals.some((p) => p.from === i)) { S.proposals.push({ from: i, type: 'alliance', day: S.day, expires: S.day + 30 }); toast(S, `${C.short} proposes a defense alliance`, 'Diplomacy'); } }
      else if (chance(S, acceptChance(S, 'alliance', i, j))) signTreaty(S, 'alliance', i, j);
    } else if (r < 0.4 && rel(S, i, j) < -55 && !isSanctioning(S, i, j) && chance(S, L.aggression)) {
      S.sanctions.push({ from: i, to: j, since: S.day }); addRel(S, i, j, -10);
      news(S, 'Diplomacy', `${C.short} imposes sanctions on ${S.countries[j].short}`, `The measures target banking and technology sectors.`, { intl: j !== 0, imp: j === 0 ? 3 : 1, tone: j === 0 ? -1 : 0 });
    } else if (r < 0.45 && S.sanctions.some((s) => s.from === i && s.to === j) && rel(S, i, j) > -25) {
      S.sanctions = S.sanctions.filter((s) => !(s.from === i && s.to === j));
      news(S, 'Diplomacy', `${C.short} lifts sanctions on ${S.countries[j].short}`, 'A sign of thawing relations.', { intl: j !== 0 });
    } else if (r < 0.5 && j === 0 && L.aggression > 0.6 && rel(S, i, 0) < -30 && !S.proposals.some((p) => p.from === i)) {
      const amt = S.countries[0].econ.gdp * 0.002;
      S.proposals.push({ from: i, type: 'demand', amount: amt, day: S.day, expires: S.day + 20 });
      toast(S, `${C.short} issues an ultimatum`, 'Diplomacy', -1);
    }
    // AI economic policy: drift budget toward balance
    const e = C.econ, dp = e.deficit / e.gdp * 100;
    if (dp > 4) { C.taxes.income = clamp(C.taxes.income + 0.3, 15, 45); C.budget.welfare = clamp(C.budget.welfare - 0.05, 2, 10); }
    if (dp < 0.5 && e.unemployment > 7) { C.budget.infrastructure = clamp(C.budget.infrastructure + 0.08, 1, 6); }
    C.budget.defense = clamp(C.budget.defense + (L.aggression - 0.45) * 0.02 + (atWar(S, i).length ? 0.2 : 0), 0.8, 6);
    // Elections & coups
    if (C.nextElection && S.day >= C.nextElection) {
      C.nextElection = S.day + 1461;
      const incumbentWins = chance(S, clamp(0.35 + (C.stability - 55) / 80, 0.1, 0.85));
      if (!incumbentWins) { const old = newLeaderFor(S, C); news(S, 'World', `${C.short} elects ${C.leader.name}`, `${old.name} was defeated. Analysts expect a shift in ${C.adj} foreign policy.`, { intl: true, imp: 2 }); }
      else news(S, 'World', `${L.name} re-elected in ${C.short}`, `Turnout was high in a closely watched vote.`, { intl: true });
    }
    if ((C.gov === 'autocracy' || C.gov === 'monarchy') && C.stability < 30 && chance(S, 0.08)) {
      const old = newLeaderFor(S, C); C.stability = 55;
      news(S, 'World', `Coup in ${C.short}: ${old.name} ousted`, `${C.leader.name} has seized power in ${C.capital}.`, { intl: true, imp: 3 });
    }
  }
  // AI-AI wars of opportunity are rare and handled by disputes. Expire proposals.
  S.proposals = S.proposals.filter((p) => p.expires > S.day);
  // World interest rate follows average inflation
  const avgInf = S.countries.reduce((s, c) => s + c.econ.inflation, 0) / n;
  S.worldRate += ((1 + avgInf * 1.2) - S.worldRate) * 0.1;
}

export function hostileNeighbours(S) { return S.countries.filter((c, i) => i > 0 && rel(S, 0, i) < -30); }
