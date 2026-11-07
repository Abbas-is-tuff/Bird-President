// Executive branch: cabinet, departments, executive orders, emergencies, press & speeches.
import { POSITIONS, ORDERS, PARTIES } from './data.js';
import { clamp, chance, rand, pick, fmtMoney, pct } from './util.js';
import { news, slanted, toast, partyName } from './news.js';

export const charName = (S, id) => (id && S.chars[id] ? S.chars[id].name : 'Vacant');
export const isGoverning = (S) => S.pol.phase === 'governing';
export const president = (S) => S.chars[S.player.birdId];

// Department efficiency 0.6 .. 1.35 from the minister's competence and specialty fit.
export function deptEfficiency(S, pos) {
  if (!S.pol || !isGoverning(S)) return 1;
  const id = S.pol.cabinet[pos];
  if (!id) return 0.75;
  const ch = S.chars[id];
  const P = POSITIONS.find((p) => p.id === pos);
  let e = 0.7 + ch.competence / 200 + (P.spec.includes(ch.specialty) ? 0.12 : 0);
  if (ch.trait === 'Fast but lazy') e += 0.04 * Math.sin(S.day / 23); // brilliant bursts, slack weeks
  return clamp(e, 0.6, 1.35);
}

export function availableFor(S, pos) {
  const pres = S.player.birdId;
  return Object.values(S.chars).filter((c) => c.id !== pres && c.status === 'active' && (!c.role || c.role === pos));
}

// Returns {ok, msg}
export function appoint(S, pos, charId) {
  const ch = S.chars[charId];
  if (!ch || ch.status !== 'active') return { ok: false, msg: 'Unavailable.' };
  const pol = S.pol;
  const sameParty = ch.party === S.player.partyId;
  const coalition = pol.coalition.includes(ch.party);
  const isLeader = Object.values(S.parties).some((p) => p.leader === charId) && !sameParty;
  if (!sameParty) {
    let p = coalition ? 0.85 : 0.35;
    if (isLeader) p = coalition ? 0.4 : 0.12;
    p += (pol.approval - 50) / 200;
    if (!chance(S, clamp(p, 0.03, 0.95))) {
      pol.capital = Math.max(0, pol.capital - 3);
      news(S, 'Government', `${ch.name} turns down offer to become ${POSITIONS.find((x) => x.id === pos).name}`, `${ch.name} of the ${partyName(ch.party)} declined the President's offer, saying the party "will not prop up this government".`, { tone: -0.5 });
      return { ok: false, msg: `${ch.name} declined the appointment.` };
    }
  }
  // free previous holder & previous role
  if (ch.role && ch.role !== pos) pol.cabinet[ch.role] = null;
  const prev = pol.cabinet[pos];
  if (prev && S.chars[prev]) S.chars[prev].role = null;
  pol.cabinet[pos] = charId; ch.role = pos;
  if (!sameParty) { pol.mood += 0.015; S.parties[ch.party].relation = clamp(S.parties[ch.party].relation + 8, 0, 100); }
  const P = POSITIONS.find((x) => x.id === pos);
  if (isGoverning(S)) news(S, 'Government', `${ch.name} appointed ${P.name}`, `The President named ${ch.name}, a ${ch.species.toLowerCase()} known as a "${ch.trait.toLowerCase()}", to lead ${P.dept}. Competence rating: ${ch.competence}/100.`, { outlet: 'herald' });
  return { ok: true, msg: `${ch.name} is now ${P.name}.` };
}

export function fire(S, pos) {
  const pol = S.pol, id = pol.cabinet[pos];
  if (!id) return { ok: false, msg: 'Position already vacant.' };
  const ch = S.chars[id];
  pol.cabinet[pos] = null; ch.role = null;
  ch.loyalty = clamp(ch.loyalty - 25, 0, 100);
  pol.capital = Math.max(0, pol.capital - 5);
  const penalty = ch.scandals > 0 ? 0.01 : -0.012;
  pol.mood += penalty;
  if (ch.party !== S.player.partyId && S.parties[ch.party]) S.parties[ch.party].relation = clamp(S.parties[ch.party].relation - 12, 0, 100);
  slanted(S, 'Government', {
    neutral: `President dismisses ${ch.name}`,
    right: `Chaos in cabinet as ${ch.name} is sacked`,
    left: `${ch.name} out after turbulent tenure`,
  }, `${ch.name} has been removed as ${POSITIONS.find((x) => x.id === pos).name}. ${ch.scandals ? 'The dismissal follows weeks of scandal.' : 'Allies called the move "baffling".'}`, { imp: 2 });
  return { ok: true, msg: `${ch.name} dismissed.` };
}

export function autoFillCabinet(S) {
  for (const P of POSITIONS) {
    if (S.pol.cabinet[P.id]) continue;
    const cands = availableFor(S, P.id).filter((c) => !c.role && (c.party === S.player.partyId || S.pol.coalition.includes(c.party)));
    cands.sort((a, b) => score(b) - score(a));
    function score(c) { return c.competence + (P.spec.includes(c.specialty) ? 25 : 0) + (c.party === S.player.partyId ? 5 : 0); }
    if (cands[0]) { S.pol.cabinet[P.id] = cands[0].id; cands[0].role = P.id; }
  }
}

// ---- Executive orders ----
export function canSignOrder(S, id) {
  const O = ORDERS.find((o) => o.id === id);
  if (!isGoverning(S)) return 'Only the sitting President can sign orders.';
  if (S.pol.orders.some((o) => o.id === id)) return 'Already in force.';
  if (O.emergency && !S.pol.emergency) return 'Requires a declared national emergency.';
  if (S.pol.capital < O.pc) return `Needs ${O.pc} political capital.`;
  return null;
}

export function signOrder(S, id) {
  const err = canSignOrder(S, id); if (err) return { ok: false, msg: err };
  const O = ORDERS.find((o) => o.id === id);
  const c = S.countries[0], e = c.econ;
  S.pol.capital -= O.pc;
  S.pol.orders.push({ id, expires: S.day + O.days, signed: S.day, courtCheck: S.day + 20 });
  if (id === 'relief') { e.debt += e.gdp * 0.005; S.flags.reliefBoost = S.day + 60; e.inflShock += 0.25; e.moodShock += 3; }
  if (id === 'borderlock') for (let i = 1; i < S.countries.length; i++) { S.rel[0][i] -= 3; S.rel[i][0] -= 3; }
  if (id === 'lobbyban') { c.corruption = Math.max(0, c.corruption - 4); for (const p of Object.values(S.parties)) p.relation = clamp(p.relation - 4, 0, 100); }
  if (id === 'curfew') { S.pol.protest = null; }
  slanted(S, 'Government', {
    neutral: `President signs executive order: ${O.name}`,
    right: id === 'stimulus' || id === 'relief' || id === 'paybump' ? `More spending: President signs ${O.name}` : `President signs ${O.name}`,
    left: id === 'freeze' || id === 'curfew' || id === 'borderlock' ? `Critics alarmed by ${O.name} order` : `President signs ${O.name}`,
  }, `${O.desc} The order takes effect immediately${O.days > 1 ? ` and runs for ${O.days} days` : ''}.`, { imp: 2 });
  return { ok: true, msg: `${O.name} signed.` };
}

export function revokeOrder(S, id) {
  S.pol.orders = S.pol.orders.filter((o) => o.id !== id);
  news(S, 'Government', `Executive order revoked: ${ORDERS.find((o) => o.id === id).name}`, `The President has rescinded the order.`);
}

export function dailyOrders(S) {
  const pol = S.pol;
  for (const o of [...pol.orders]) {
    const O = ORDERS.find((x) => x.id === o.id);
    if (o.courtCheck && S.day >= o.courtCheck) {
      o.courtCheck = null;
      if (chance(S, O.court * (S.pol.activeLaws.includes('press') ? 1.2 : 1))) {
        pol.orders = pol.orders.filter((x) => x !== o);
        pol.mood -= 0.02;
        news(S, 'Justice', `Supreme Court strikes down ${O.name}`, `In a 5–4 ruling the Court found the order exceeded presidential authority. The decision is a blow to the administration.`, { imp: 2, tone: -1 });
        continue;
      }
    }
    if (S.day >= o.expires) {
      pol.orders = pol.orders.filter((x) => x !== o);
      if (O.days > 1) news(S, 'Government', `${O.name} expires`, `The executive order has reached the end of its term.`);
      if (o.id === 'pricecap') S.countries[0].econ.inflShock += 1.2; // rebound
    }
  }
}

// ---- National emergency ----
export const EMERGENCY_TYPES = { economic: 'Economic emergency', security: 'Security emergency', disaster: 'Natural disaster emergency', health: 'Public health emergency' };

export function declareEmergency(S, type) {
  const pol = S.pol;
  if (pol.emergency) return { ok: false, msg: 'An emergency is already in effect.' };
  const justified = (type === 'disaster' && S.flags.recentDisaster > S.day - 45) || (type === 'security' && (S.wars.some((w) => w.a === 0 || w.b === 0) || S.disputes.some((d) => (d.a === 0 || d.b === 0) && d.tension > 75)))
    || (type === 'economic' && S.countries[0].econ.growth < -1) || (type === 'health' && S.flags.outbreak > S.day - 60);
  pol.emergency = { type, since: S.day, justified };
  pol.capital = clamp(pol.capital + 10, 0, 100);
  pol.mood += justified ? 0.04 : -0.05;
  slanted(S, 'Government', {
    neutral: `President declares ${EMERGENCY_TYPES[type].toLowerCase()}`,
    right: justified ? `Decisive action: national emergency declared` : `Power grab? President declares emergency`,
    left: justified ? `Emergency declared as crisis deepens` : `Civil liberties groups condemn emergency decree`,
  }, `Emergency powers allow faster spending and special executive orders. ${justified ? 'Most citizens support the move.' : 'Opposition parties say there is no genuine emergency.'}`, { imp: 3, tone: justified ? 0 : -1 });
  return { ok: true, msg: 'Emergency declared.' };
}

export function endEmergency(S, forced = false) {
  if (!S.pol.emergency) return;
  S.pol.emergency = null;
  S.pol.orders = S.pol.orders.filter((o) => o.id !== 'curfew');
  news(S, 'Government', forced ? 'Parliament revokes state of emergency' : 'President lifts state of emergency', forced ? 'Lawmakers voted to end emergency powers, dealing a defeat to the President.' : 'Normal constitutional order has been restored.', { imp: 2, tone: forced ? -1 : 0 });
  if (forced) S.pol.mood -= 0.03;
}

// ---- Press conference ----
// Questions are built from what is happening right now.
export function buildPressConference(S) {
  const e = S.countries[0].econ, pol = S.pol;
  const qs = [];
  if (e.inflation > 3.5) qs.push({ topic: 'inflation', q: `Inflation is at ${pct(e.inflation)}. What are you doing about prices?`, ok: e.inflation < 5 });
  if (e.unemployment > 7) qs.push({ topic: 'jobs', q: `${pct(e.unemployment)} of workers are unemployed. Why should they trust you?`, ok: false });
  if (e.growth > 2.5) qs.push({ topic: 'growth', q: `Growth is strong at ${pct(e.growth)}. Is the economy overheating?`, ok: true });
  if (pol.scandals.length) { const sc = pol.scandals[pol.scandals.length - 1]; qs.push({ topic: 'scandal', q: `Will you comment on the allegations against ${S.chars[sc.char]?.name}?`, ok: false }); }
  if (pol.protest) qs.push({ topic: 'protest', q: `Thousands are protesting in ${pol.protest.city}. Are you listening?`, ok: false });
  const war = S.wars.find((w) => w.a === 0 || w.b === 0);
  if (war) qs.push({ topic: 'war', q: `How long will the conflict with ${S.countries[war.a === 0 ? war.b : war.a].short} last?`, ok: (war.a === 0 ? war.score : -war.score) > 0 });
  const disp = S.disputes.find((d) => (d.a === 0 || d.b === 0) && !d.resolved && d.tension > 55);
  if (disp) qs.push({ topic: 'dispute', q: `Tensions over ${disp.name} are rising. Will you defend our border?`, ok: true });
  if (e.debt / e.gdp > 0.85) qs.push({ topic: 'debt', q: `Debt is ${(e.debt / e.gdp * 100).toFixed(0)}% of GDP. Is the nation going broke?`, ok: false });
  if (pol.approval < 40) qs.push({ topic: 'approval', q: `Your approval is ${pol.approval.toFixed(0)}%. Is your presidency failing?`, ok: false });
  const filler = [
    { topic: 'agenda', q: 'What is your top priority for the next six months?', ok: true },
    { topic: 'opposition', q: `${S.chars[S.parties[S.player.partyId === 'nest' ? 'free' : 'nest'].leader]?.name || 'The opposition'} says you are out of touch. Your response?`, ok: true },
    { topic: 'foreign', q: `How would you describe relations with ${S.countries[1].short}?`, ok: S.rel[0][1] > 0 },
  ];
  while (qs.length < 3) qs.push(filler[qs.length % filler.length]);
  return qs.slice(0, 3).map((x) => ({ ...x, options: [
    { id: 'confident', label: 'Answer confidently with facts and figures' },
    { id: 'empathetic', label: 'Acknowledge concerns and promise action' },
    { id: 'deflect', label: 'Deflect and pivot to your achievements' },
    { id: 'attack', label: 'Attack the premise and the press' },
  ] }));
}

export function answerPress(S, q, optId) {
  const pres = president(S), pol = S.pol;
  const ch = pres.charisma / 100;
  let d = 0, media = 0, txt = '';
  if (optId === 'confident') { d = q.ok ? 0.012 + ch * 0.01 : -0.006; media = q.ok ? 2 : -1; txt = q.ok ? 'came across as in command of the facts' : 'sounded out of touch with reality'; }
  if (optId === 'empathetic') { d = q.ok ? 0.004 : 0.01 + ch * 0.006; media = 2; txt = 'struck a sympathetic tone'; }
  if (optId === 'deflect') { d = -0.002 + (rand(S) - 0.5) * 0.01; media = -2; txt = 'dodged the question'; }
  if (optId === 'attack') { d = (S.player.partyId === 'talon' || S.player.partyId === 'nest' ? 0.004 : -0.008); media = -6; txt = 'lashed out at journalists'; }
  pol.mood += d; pol.media = clamp(pol.media + media, 0, 100);
  return { d, txt };
}

export function finishPress(S, results) {
  const good = results.filter((r) => r.d > 0).length;
  S.pol.pressCooldown = S.day + 14;
  const best = results.reduce((a, b) => (b.d > a.d ? b : a), results[0]);
  const worst = results.reduce((a, b) => (b.d < a.d ? b : a), results[0]);
  slanted(S, 'Press', {
    neutral: good >= 2 ? 'President delivers assured press conference' : 'President faces tough questions at press conference',
    right: good >= 2 ? 'President holds firm under questioning' : 'Rattled President stumbles through press conference',
    left: good >= 2 ? 'President connects with public concerns' : 'President fails to answer the hard questions',
  }, `During the briefing the President ${best.txt}${worst !== best ? `, but at another moment ${worst.txt}` : ''}. Media relations now stand at ${S.pol.media.toFixed(0)}/100.`, { imp: 2, tone: good >= 2 ? 1 : -1 });
}

// ---- Speeches ----
export const SPEECH_TOPICS = { economy: 'The economy', unity: 'National unity', security: 'Security & defence', reform: 'Government reform', foreign: 'Our place in the world' };
export const SPEECH_TONES = { inspiring: 'Inspiring', sober: 'Sober & honest', combative: 'Combative' };

export function giveSpeech(S, topic, tone) {
  const pol = S.pol, e = S.countries[0].econ, ch = president(S).charisma / 100;
  if (pol.speechCooldown > S.day) return { ok: false, msg: 'You addressed the nation recently. Wait a few days.' };
  let fit = 0;
  if (topic === 'economy') fit = e.growth > 1.5 && e.unemployment < 7 ? 1 : -0.5;
  if (topic === 'unity') fit = pol.protest || pol.approval < 45 ? 1 : 0.3;
  if (topic === 'security') fit = S.wars.some((w) => w.a === 0 || w.b === 0) || S.disputes.some((d) => d.a === 0 && d.tension > 60) ? 1 : -0.2;
  if (topic === 'reform') fit = pol.scandals.length ? 0.8 : 0.3;
  if (topic === 'foreign') fit = S.countries.slice(1).filter((c, i) => S.rel[0][i + 1] > 40).length >= 3 ? 0.7 : 0.1;
  let toneMul = tone === 'inspiring' ? 1 + ch * 0.6 : tone === 'sober' ? (fit < 0 ? 1.4 : 0.8) : 0.7;
  if (tone === 'sober' && fit < 0) fit = 0.5;
  let d = 0.012 * fit * toneMul;
  if (tone === 'combative') { d += S.player.partyId === 'talon' ? 0.01 : -0.004; pol.media = clamp(pol.media - 3, 0, 100); }
  pol.mood += d;
  pol.speechCooldown = S.day + 10;
  pol.capital = clamp(pol.capital + (d > 0 ? 4 : 0), 0, 100);
  if (topic === 'unity' && pol.protest && d > 0) pol.protest.intensity *= 0.7;
  slanted(S, 'Speech', {
    neutral: `President addresses the nation on ${SPEECH_TOPICS[topic].toLowerCase()}`,
    right: d > 0 ? `A presidential moment: address on ${SPEECH_TOPICS[topic].toLowerCase()} lands well` : `Hollow words: President's speech falls flat`,
    left: d > 0 ? `President's ${SPEECH_TONES[tone].toLowerCase()} address strikes a chord` : `Speech on ${SPEECH_TOPICS[topic].toLowerCase()} met with scepticism`,
  }, `In a ${SPEECH_TONES[tone].toLowerCase()} televised address the President spoke about ${SPEECH_TOPICS[topic].toLowerCase()}. Snap polling suggests the speech ${d > 0.008 ? 'went down very well' : d > 0 ? 'was received positively' : 'did not persuade'}.`, { imp: 2, tone: d > 0 ? 1 : -1 });
  return { ok: true, msg: d > 0.008 ? 'The speech was a triumph.' : d > 0 ? 'The speech was well received.' : 'The speech fell flat.', d };
}

export function monthlyGovernment(S) {
  const pol = S.pol;
  // Political capital regenerates with approval; emergencies end if parliament objects.
  pol.capital = clamp(pol.capital + 2 + (pol.approval - 45) / 8, 0, 100);
  if (pol.emergency && !pol.emergency.justified && S.day - pol.emergency.since > 30) {
    const coalitionSeats = pol.coalition.reduce((s, id) => s + S.parties[id].seats, 0);
    if (coalitionSeats < 101 && chance(S, 0.6)) endEmergency(S, true);
  }
  // Minister loyalty & resignations
  for (const P of POSITIONS) {
    const id = pol.cabinet[P.id]; if (!id) continue;
    const ch = S.chars[id];
    ch.loyalty = clamp(ch.loyalty + (pol.approval - 45) / 40, 0, 100);
    if (ch.loyalty < 35 && pol.approval < 38 && chance(S, 0.12)) {
      pol.cabinet[P.id] = null; ch.role = null;
      pol.mood -= 0.02;
      news(S, 'Government', `${ch.name} resigns as ${P.name}`, `In a sharply worded letter, ${ch.name} said they could "no longer serve in good conscience". The resignation is a blow to the government.`, { imp: 3, tone: -1 });
    }
  }
}
