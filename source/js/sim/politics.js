// Legislature, parties, coalitions, campaigns and elections.
import { PARTIES, LAWS, CITIES, BUDGET_KEYS } from './data.js';
import { clamp, chance, rand, pick, gauss, avg, sum, pct } from './util.js';
import { news, slanted, toast, partyName } from './news.js';
import { isGoverning, autoFillCabinet, president } from './government.js';
import { startCampaign } from './setup.js';
import { taxEffective } from './economy.js';

const SEATS = 200, MAJ = 101, OVERRIDE = 134;
export { SEATS, MAJ, OVERRIDE };
export const partyDef = (id) => PARTIES.find((p) => p.id === id);
export const lawDef = (id) => LAWS.find((l) => l.id === id);

// The government's perceived ideological position (what citizens & parties react to).
export function govStance(S) {
  const c = S.countries[0], pres = president(S);
  const laws = S.pol.activeLaws.map(lawDef).filter(Boolean);
  const lawE = laws.length ? avg(laws.map((l) => l.econ)) : pres.econ;
  const lawS = laws.length ? avg(laws.map((l) => l.social)) : pres.social;
  const taxE = clamp((21 - taxEffective(c) * 100) / 8, -1, 1);
  const welfE = clamp((5.2 - c.budget.welfare) / 3 + (4.5 - c.budget.health) / 4, -1, 1);
  const econ = clamp(pres.econ * 0.3 + lawE * 0.3 + taxE * 0.25 + welfE * 0.15, -1, 1);
  const social = clamp(pres.social * 0.4 + lawS * 0.6, -1, 1);
  S.pol.stance = { econ, social };
  return S.pol.stance;
}

export const coalitionSeats = (S) => S.pol.coalition.reduce((s, id) => s + (S.parties[id]?.seats || 0), 0);

// ---- Parliamentary vote model ----
// Each party votes mostly as a bloc; support depends on ideological fit, coalition discipline,
// relations with the President and the President's popularity.
function partySupport(S, pid, pos, opts = {}) {
  const P = partyDef(pid), st = S.parties[pid];
  const dist = Math.hypot(P.econ - pos.econ, P.social - pos.social) / 2.0; // 0..~1.3
  let s = 1 - dist * 1.1;
  const inCoalition = S.pol.coalition.includes(pid);
  if (!opts.noPres) {
    if (pid === S.player.partyId) s += 0.45;
    else if (inCoalition) s += 0.25;
    else s -= 0.1;
    s += (st.relation - 50) / 250 + (S.pol.approval - 50) / 250 + (opts.lobby || 0) * 0.12;
  }
  if (opts.override) s += pid === S.player.partyId ? -0.6 : 0.05;
  return clamp(s, 0, 1);
}

export function predictVote(S, pos, opts = {}) {
  const res = { yes: 0, no: 0, parties: {} };
  for (const P of PARTIES) {
    const seats = S.parties[P.id].seats;
    const sup = partySupport(S, P.id, pos, opts);
    const yesFrac = clamp((sup - 0.5) * 3.2 + 0.5, 0, 1);
    const y = Math.round(seats * yesFrac);
    res.parties[P.id] = { yes: y, no: seats - y, sup };
    res.yes += y; res.no += seats - y;
  }
  return res;
}

function castVote(S, pos, opts = {}) {
  const pr = predictVote(S, pos, opts);
  // add noise: a few rebels/defectors
  let yes = 0;
  for (const P of PARTIES) {
    const seats = S.parties[P.id].seats;
    const swing = Math.round(gauss(S) * Math.max(1, seats * 0.04));
    const y = clamp(pr.parties[P.id].yes + swing, 0, seats);
    pr.parties[P.id].yes = y; pr.parties[P.id].no = seats - y; yes += y;
  }
  pr.yes = yes; pr.no = SEATS - yes;
  return pr;
}

// ---- Bills ----
export function lawPosition(id, repeal = false) {
  const L = lawDef(id);
  return repeal ? { econ: -L.econ * 0.7, social: -L.social * 0.7 } : { econ: L.econ, social: L.social };
}

export function canPropose(S, id, repeal = false) {
  const pol = S.pol, L = lawDef(id);
  if (!isGoverning(S)) return 'You must be President to propose legislation.';
  if (pol.bills.some((b) => b.law === id)) return 'Already before parliament.';
  if (!repeal && pol.activeLaws.includes(id)) return 'Already law.';
  if (repeal && !pol.activeLaws.includes(id)) return 'Not currently law.';
  if (!repeal && L.excludes && pol.activeLaws.includes(L.excludes)) return `Conflicts with ${lawDef(L.excludes).name}. Repeal it first.`;
  if (pol.capital < 8) return 'Needs 8 political capital.';
  return null;
}

export function proposeBill(S, id, repeal = false, lobby = 0) {
  const err = canPropose(S, id, repeal); if (err) return { ok: false, msg: err };
  const pol = S.pol;
  const cost = 8 + lobby * 10;
  if (pol.capital < cost) return { ok: false, msg: `Needs ${cost} political capital.` };
  pol.capital -= cost;
  pol.bills.push({ law: id, repeal, origin: 'gov', stage: 'parliament', intro: S.day, voteDay: S.day + 14, lobby });
  const L = lawDef(id);
  news(S, 'Parliament', `${repeal ? 'Repeal of the ' : ''}${L.name} introduced in Parliament`, `The government's bill will go to a vote in two weeks. ${L.desc}`, { outlet: 'herald' });
  return { ok: true, msg: 'Bill introduced. Vote in 14 days.' };
}

// Budget & tax changes need parliamentary approval.
export function budgetPosition(S, budget, taxes) {
  const c = S.countries[0];
  const dTax = (taxes.income - c.taxes.income) * 0.45 + (taxes.corporate - c.taxes.corporate) * 0.15 + (taxes.sales - c.taxes.sales) * 0.55;
  const dWel = (budget.welfare - c.budget.welfare) + (budget.health - c.budget.health) + (budget.education - c.budget.education);
  const dDef = (budget.defense - c.budget.defense) + (budget.security - c.budget.security);
  const econ = clamp(-dTax / 3 - dWel / 3, -1, 1) * 0.9;
  const social = clamp(dDef / 2, -1, 1) * 0.6;
  const size = Math.abs(dTax) + Math.abs(dWel) + Math.abs(dDef) + Math.abs(budget.infrastructure - c.budget.infrastructure) + Math.abs(budget.research - c.budget.research) + Math.abs(budget.admin - c.budget.admin);
  return { econ, social, size };
}

export function proposeBudget(S, budget, taxes) {
  if (!isGoverning(S)) return { ok: false, msg: 'You must be President.' };
  if (S.pol.budgetBill) return { ok: false, msg: 'A budget is already before parliament.' };
  S.pol.budgetBill = { budget: { ...budget }, taxes: { ...taxes }, voteDay: S.day + 7, intro: S.day };
  news(S, 'Parliament', 'Government tables new budget', `Income tax ${taxes.income}%, corporate ${taxes.corporate}%, sales ${taxes.sales}%. Defense ${budget.defense.toFixed(1)}% of GDP, health ${budget.health.toFixed(1)}%. Parliament votes in 7 days.`, { outlet: 'biz' });
  return { ok: true, msg: 'Budget tabled. Parliament votes in 7 days.' };
}

export function predictBudget(S, budget, taxes) {
  const pos = budgetPosition(S, budget, taxes);
  const center = { econ: S.pol.stance.econ + pos.econ, social: S.pol.stance.social + pos.social };
  const pr = predictVote(S, center);
  // small changes are routine; give a bonus
  const bonus = Math.round(clamp(20 - pos.size * 4, 0, 20));
  pr.yes = Math.min(SEATS, pr.yes + bonus); pr.no = SEATS - pr.yes;
  return pr;
}

function resolveBudget(S) {
  const bb = S.pol.budgetBill;
  const pr = predictBudget(S, bb.budget, bb.taxes);
  const yes = clamp(pr.yes + Math.round(gauss(S) * 4), 0, SEATS);
  const c = S.countries[0];
  S.pol.budgetBill = null;
  S.pol.voteLog.unshift({ day: S.day, title: 'National Budget', yes, no: SEATS - yes, passed: yes >= MAJ });
  if (yes >= MAJ) {
    const dTax = (bb.taxes.income - c.taxes.income) * 0.45 + (bb.taxes.sales - c.taxes.sales) * 0.55;
    c.budget = { ...bb.budget }; c.taxes = { ...bb.taxes };
    S.pol.mood -= clamp(dTax, -6, 6) * 0.006; // tax rises are unpopular, cuts popular
    c.econ.moodShock -= dTax * 0.8;
    slanted(S, 'Parliament', { neutral: `Budget passes ${yes}–${SEATS - yes}`, right: dTax > 0 ? `Tax hike budget squeaks through` : `Budget passes`, left: dTax < 0 ? `Tax-cut budget approved` : `Budget passes` }, `The new budget takes effect immediately.`, { imp: 2, tone: 1 });
  } else {
    S.pol.mood -= 0.012; S.pol.capital = Math.max(0, S.pol.capital - 6);
    news(S, 'Parliament', `Parliament rejects government budget ${yes}–${SEATS - yes}`, `A humiliating defeat for the President. The previous budget remains in force.`, { imp: 3, tone: -1 });
  }
}

function enactLaw(S, id, repeal) {
  const pol = S.pol, L = lawDef(id), c = S.countries[0];
  if (repeal) {
    pol.activeLaws = pol.activeLaws.filter((x) => x !== id);
    if (id === 'cbind') c.cbIndependent = false;
  } else {
    pol.activeLaws.push(id);
    if (id === 'anticorr') c.corruption = Math.max(0, c.corruption - 6);
    if (id === 'dereg') c.corruption += 3;
    if (id === 'cbind') c.cbIndependent = true;
    if (id === 'tariffs') for (let i = 1; i < S.countries.length; i++) { S.rel[0][i] -= 6; S.rel[i][0] -= 6; }
  }
}

function resolveBill(S, bill) {
  const L = lawDef(bill.law);
  const pos = lawPosition(bill.law, bill.repeal);
  const pr = castVote(S, pos, { lobby: bill.lobby, noPres: bill.origin === 'parl' });
  const passed = pr.yes >= MAJ;
  const title = (bill.repeal ? 'Repeal: ' : '') + L.name;
  S.pol.voteLog.unshift({ day: S.day, title, yes: pr.yes, no: pr.no, passed, parties: pr.parties });
  if (S.pol.voteLog.length > 40) S.pol.voteLog.length = 40;
  if (bill.origin === 'gov') {
    S.pol.bills = S.pol.bills.filter((b) => b !== bill);
    if (passed) {
      enactLaw(S, bill.law, bill.repeal);
      S.pol.capital = clamp(S.pol.capital + 4, 0, 100);
      slanted(S, 'Parliament', { neutral: `${title} passes ${pr.yes}–${pr.no}`, right: pos.econ < -0.3 ? `Big-spending ${L.name} forced through` : `${title} passes`, left: pos.econ > 0.3 ? `${title} passes despite protests` : `Landmark ${title} becomes law` }, `${L.desc} The President is expected to sign the bill into law today.`, { imp: 2, tone: 1 });
    } else {
      S.pol.mood -= 0.008;
      news(S, 'Parliament', `Defeat for President as ${title} fails ${pr.yes}–${pr.no}`, `The bill fell short of the ${MAJ} votes required.`, { imp: 2, tone: -1 });
    }
  } else if (bill.stage === 'parliament') {
    if (passed) {
      bill.stage = 'desk'; bill.deskDeadline = S.day + 10; bill.vote = pr;
      news(S, 'Parliament', `Parliament passes ${title}; bill sent to President`, `Sponsored by the ${partyName(bill.sponsor)}. The President has 10 days to sign or veto.`, { imp: 2 });
      toast(S, `Bill on your desk: ${title}`, 'Parliament');
    } else {
      S.pol.bills = S.pol.bills.filter((b) => b !== bill);
      news(S, 'Parliament', `${title} defeated ${pr.yes}–${pr.no}`, `The ${partyName(bill.sponsor)} bill failed to win a majority.`);
    }
  }
}

export function signBill(S, bill) {
  enactLaw(S, bill.law, bill.repeal);
  S.pol.bills = S.pol.bills.filter((b) => b !== bill);
  const L = lawDef(bill.law), P = partyDef(S.player.partyId);
  const dist = Math.hypot(P.econ - L.econ, P.social - L.social);
  if (dist > 1) { S.parties[S.player.partyId].relation -= 6; }
  if (S.parties[bill.sponsor]) S.parties[bill.sponsor].relation = clamp(S.parties[bill.sponsor].relation + 8, 0, 100);
  news(S, 'Government', `President signs ${bill.repeal ? 'repeal of ' : ''}${L.name} into law`, dist > 1 ? 'Members of the President\'s own party expressed frustration.' : 'The law takes effect immediately.', { imp: 2 });
}

export function vetoBill(S, bill) {
  const L = lawDef(bill.law);
  S.pol.capital = Math.max(0, S.pol.capital - 4);
  const pr = castVote(S, lawPosition(bill.law, bill.repeal), { override: true });
  S.pol.bills = S.pol.bills.filter((b) => b !== bill);
  if (S.parties[bill.sponsor]) S.parties[bill.sponsor].relation = clamp(S.parties[bill.sponsor].relation - 10, 0, 100);
  if (pr.yes >= OVERRIDE) {
    enactLaw(S, bill.law, bill.repeal);
    S.pol.mood -= 0.02;
    news(S, 'Parliament', `Parliament overrides presidential veto of ${L.name}`, `${pr.yes} members voted to override, above the two-thirds threshold of ${OVERRIDE}.`, { imp: 3, tone: -1 });
    return { ok: true, msg: `Veto overridden ${pr.yes}–${pr.no}.` };
  }
  news(S, 'Government', `President vetoes ${L.name}`, `An override attempt gathered only ${pr.yes} votes, short of ${OVERRIDE}.`, { imp: 2 });
  return { ok: true, msg: `Veto sustained (${pr.yes} override votes).` };
}

function parliamentInitiatives(S) {
  if (!isGoverning(S) || !chance(S, 0.22)) return;
  const pol = S.pol;
  const sponsors = PARTIES.filter((p) => p.id !== S.player.partyId).sort((a, b) => S.parties[b.id].seats - S.parties[a.id].seats);
  const sp = sponsors[Math.floor(rand(S) * Math.min(3, sponsors.length))];
  // pick a law the sponsor likes: enact a liked one or repeal a disliked active one
  const opts = [];
  for (const L of LAWS) {
    const d = Math.hypot(sp.econ - L.econ, sp.social - L.social);
    if (pol.bills.some((b) => b.law === L.id)) continue;
    if (!pol.activeLaws.includes(L.id) && d < 0.7 && !(L.excludes && pol.activeLaws.includes(L.excludes))) opts.push({ id: L.id, repeal: false, w: 1 - d });
    if (pol.activeLaws.includes(L.id) && d > 1.2) opts.push({ id: L.id, repeal: true, w: (d - 1.1) });
  }
  if (!opts.length) return;
  const choice = opts.sort((a, b) => b.w - a.w)[Math.floor(rand(S) * Math.min(3, opts.length))];
  pol.bills.push({ law: choice.id, repeal: choice.repeal, origin: 'parl', sponsor: sp.id, stage: 'parliament', intro: S.day, voteDay: S.day + 12, lobby: 0 });
  news(S, 'Parliament', `${sp.name} tables ${choice.repeal ? 'repeal of ' : ''}${lawDef(choice.id).name}`, `Debate begins this week; a vote is expected in 12 days.`);
}

export function dailyPolitics(S) {
  const pol = S.pol;
  for (const bill of [...pol.bills]) {
    if (bill.stage === 'parliament' && S.day >= bill.voteDay) resolveBill(S, bill);
    else if (bill.stage === 'desk' && S.day >= bill.deskDeadline) { signBill(S, bill); }
  }
  if (pol.budgetBill && S.day >= pol.budgetBill.voteDay) resolveBudget(S);
  // campaign & elections
  if (pol.campaign) {
    pol.campaign.daysLeft = (pol.campaign.kind === 'presidential' ? pol.nextPresElection : pol.nextParlElection) - S.day;
    if (S.day % 4 === 0) for (const P of PARTIES) if (P.id !== S.player.partyId) { const cp = pol.campaign; cp.momentum[P.id] = (cp.momentum[P.id] || 0) + rand(S) * 0.018 * (S.parties[P.id].funds / 60); }
  } else if (isGoverning(S)) {
    if (pol.nextPresElection - S.day === 60) { startCampaign(S, 'presidential'); news(S, 'Election', 'Presidential campaign officially begins', 'Sixty days until polling day. Candidates hit the road.', { imp: 3 }); }
    else if (pol.nextParlElection - S.day === 45) { startCampaign(S, 'parliamentary'); news(S, 'Election', 'Parliamentary election campaign begins', 'All 200 seats are up for grabs in 45 days.', { imp: 3 }); }
  }
  if (S.day === pol.nextPresElection) runPresidentialElection(S);
  if (S.day === pol.nextParlElection) runParliamentElection(S);
}

export function monthlyPolitics(S) {
  parliamentInitiatives(S);
  const pol = S.pol;
  pol.mood *= 0.82;
  // Party relations drift toward ideological affinity
  const st = govStance(S);
  for (const P of PARTIES) {
    const p = S.parties[P.id];
    const aff = 70 - Math.hypot(P.econ - st.econ, P.social - st.social) * 45 + (pol.coalition.includes(P.id) ? 10 : 0);
    p.relation = clamp(p.relation + (aff - p.relation) * 0.08, 0, 100);
    p.funds = clamp(p.funds + p.poll / 10, 0, 200);
  }
  // Coalition partners may walk out
  for (const id of [...pol.coalition]) {
    if (id === S.player.partyId) continue;
    if (S.parties[id].relation < 25 && chance(S, 0.3)) {
      pol.coalition = pol.coalition.filter((x) => x !== id);
      for (const [pos, cid] of Object.entries(pol.cabinet)) if (cid && S.chars[cid].party === id) { pol.cabinet[pos] = null; S.chars[cid].role = null; }
      news(S, 'Parliament', `${partyDef(id).name} quits governing coalition`, `The coalition now controls ${coalitionSeats(S)} of 200 seats.`, { imp: 3, tone: -1 });
    }
  }
  // Impeachment risk
  if (isGoverning(S)) {
    pol.lowApprovalMonths = pol.approval < 22 ? pol.lowApprovalMonths + 1 : 0;
    if (pol.lowApprovalMonths >= 3 && coalitionSeats(S) < 80 && chance(S, 0.5)) {
      S.pending.push({ type: 'event', id: 'impeachment', data: {} });
    }
  }
}

// ---- Coalition management ----
export function coalitionAcceptance(S, pid) {
  const P = partyDef(pid), st = S.pol.stance;
  const d = Math.hypot(P.econ - st.econ, P.social - st.social);
  return clamp(0.95 - d * 0.55 + (S.parties[pid].relation - 50) / 150 + (S.pol.approval - 50) / 200, 0.02, 0.95);
}
export function inviteToCoalition(S, pid) {
  if (S.pol.coalition.includes(pid)) return { ok: false, msg: 'Already in coalition.' };
  if (S.pol.capital < 10) return { ok: false, msg: 'Needs 10 political capital.' };
  S.pol.capital -= 10;
  if (chance(S, coalitionAcceptance(S, pid))) {
    S.pol.coalition.push(pid); S.parties[pid].relation = clamp(S.parties[pid].relation + 10, 0, 100);
    news(S, 'Parliament', `${partyDef(pid).name} joins governing coalition`, `The coalition now commands ${coalitionSeats(S)} seats.`, { imp: 3, tone: 1 });
    return { ok: true, msg: `${partyDef(pid).name} accepted.` };
  }
  S.parties[pid].relation = clamp(S.parties[pid].relation - 4, 0, 100);
  return { ok: false, msg: `${partyDef(pid).name} rejected the offer.` };
}
export function leaveCoalition(S, pid) {
  if (pid === S.player.partyId) return { ok: false, msg: 'Cannot remove your own party.' };
  S.pol.coalition = S.pol.coalition.filter((x) => x !== pid);
  for (const [pos, cid] of Object.entries(S.pol.cabinet)) if (cid && S.chars[cid].party === pid) { S.pol.cabinet[pos] = null; S.chars[cid].role = null; }
  S.parties[pid].relation = clamp(S.parties[pid].relation - 20, 0, 100);
  news(S, 'Parliament', `President expels ${partyDef(pid).name} from coalition`, `The governing bloc shrinks to ${coalitionSeats(S)} seats.`, { imp: 2 });
  return { ok: true, msg: 'Coalition partner removed.' };
}

// ---- Campaigns ----
export const CAMPAIGN_ACTIONS = {
  rally: { name: 'Hold a rally', cost: 3, desc: 'Big boost in one city.' },
  ads: { name: 'National TV ad blitz', cost: 8, desc: 'Moderate boost everywhere.' },
  debate: { name: 'Televised debate', cost: 0, desc: 'Once per campaign. Charisma contest with the main rival.' },
  pledge: { name: 'Make a policy pledge', cost: 2, desc: 'Win over voters who care about one issue.' },
  doorknock: { name: 'Grassroots canvassing', cost: 1, desc: 'Small boost, cheap.' },
};

export function campaignCandidates(S) {
  const polls = Object.values(S.parties).sort((a, b) => b.poll - a.poll);
  const ids = [S.player.partyId];
  for (const p of polls) { if (ids.length >= 3) break; if (!ids.includes(p.id) && p.leader) ids.push(p.id); }
  return ids.map((pid) => ({ party: pid, char: S.parties[pid].leader }));
}

export function campaignAction(S, act, arg) {
  const cp = S.pol.campaign; if (!cp) return { ok: false, msg: 'No campaign running.' };
  const A = CAMPAIGN_ACTIONS[act];
  if (cp.lastActionDay === S.day) return { ok: false, msg: 'One campaign action per day. Advance time.' };
  if (cp.funds < A.cost) return { ok: false, msg: 'Not enough campaign funds.' };
  const ch = president(S).charisma / 100, me = S.player.partyId;
  cp.funds -= A.cost; cp.lastActionDay = S.day;
  cp.momentum[me] = cp.momentum[me] || 0;
  let msg = '';
  if (act === 'rally') { cp.cityBoost[arg] = (cp.cityBoost[arg] || 0) + 0.12 + ch * 0.08; msg = `Rally in ${arg} drew a huge crowd.`; news(S, 'Election', `Thousands rally for ${president(S).name} in ${arg}`, `Supporters packed the square.`); }
  if (act === 'ads') { cp.momentum[me] += 0.05; msg = 'Ads are running nationwide.'; }
  if (act === 'doorknock') { cp.momentum[me] += 0.02; msg = 'Volunteers knocked on 80,000 doors.'; }
  if (act === 'pledge') { cp.pledges.push(arg); cp.momentum[me] += 0.015; msg = `Pledge made: ${arg}.`; news(S, 'Election', `${president(S).name} pledges action on ${arg}`, `The promise targets voters concerned about ${arg}.`); }
  if (act === 'debate') {
    if (cp.debateDone) { cp.funds += A.cost; cp.lastActionDay = -1; return { ok: false, msg: 'The debate already happened.' }; }
    cp.debateDone = true;
    const rival = campaignCandidates(S).find((c) => c.party !== me);
    const rc = S.chars[rival.char];
    const myRoll = ch + rand(S) * 0.6, theirs = rc.charisma / 100 + rand(S) * 0.6;
    const won = myRoll > theirs;
    cp.momentum[me] += won ? 0.1 : -0.06;
    cp.momentum[rival.party] = (cp.momentum[rival.party] || 0) + (won ? -0.04 : 0.08);
    msg = won ? `You won the debate against ${rc.name}!` : `${rc.name} got the better of you in the debate.`;
    news(S, 'Election', won ? `${president(S).name} wins televised debate` : `${rc.name} dominates debate`, `Snap polls show ${won ? president(S).name : rc.name} ahead on who performed best.`, { imp: 3, tone: won ? 1 : -1 });
  }
  return { ok: true, msg };
}

// Citizen-level vote: utility for each option.
function citizenUtility(S, cz, pid, opts) {
  const P = partyDef(pid);
  let u = -Math.hypot(P.econ - cz.ec, P.social - cz.so) * 1.6 + (S.parties[pid].popularity || 0);
  const cp = S.pol.campaign;
  if (cp) {
    u += cp.momentum[pid] || 0;
    if (pid === S.player.partyId) {
      u += cp.cityBoost[CITIES[cz.city]] || 0;
      for (const pl of cp.pledges) if (cz.worry === pl) u += 0.12;
    }
  }
  if (opts.presidential) {
    const ch = S.chars[S.parties[pid].leader];
    if (ch) u += ch.charisma / 250;
  }
  if (isGoverning(S) && pid === S.player.partyId) u += (cz.ap - 0.5) * 1.3;
  if (isGoverning(S) && S.pol.coalition.includes(pid) && pid !== S.player.partyId) u += (cz.ap - 0.5) * 0.3;
  u += cz.j[PARTIES.findIndex((p) => p.id === pid)] * 0.35;
  return u;
}

function tally(S, pids, opts) {
  const votes = Object.fromEntries(pids.map((p) => [p, 0]));
  const byCity = CITIES.map(() => Object.fromEntries(pids.map((p) => [p, 0])));
  let turnout = 0;
  for (const cz of S.citizens) {
    const tp = 0.45 + cz.e * 0.08 + Math.min(0.2, cz.a / 300) + Math.abs(cz.h - 50) / 300;
    if (rand(S) > tp) continue;
    turnout++;
    let best = pids[0], bu = -1e9;
    for (const p of pids) { const u = citizenUtility(S, cz, p, opts) + gauss(S) * 0.12; if (u > bu) { bu = u; best = p; } }
    votes[best]++; byCity[cz.city][best]++;
  }
  const total = Math.max(1, turnout);
  return { votes, share: Object.fromEntries(pids.map((p) => [p, votes[p] / total * 100])), turnout: turnout / S.citizens.length * 100, byCity };
}

// Deterministic projection (everyone votes, no noise) used by the campaign hub's polling.
export function projectVote(S, presidential = true) {
  const pids = presidential ? campaignCandidates(S).map((c) => c.party) : PARTIES.map((p) => p.id);
  const v = Object.fromEntries(pids.map((p) => [p, 0]));
  for (const cz of S.citizens) { let best = pids[0], bu = -1e9; for (const p of pids) { const u = citizenUtility(S, cz, p, { presidential }); if (u > bu) { bu = u; best = p; } } v[best]++; }
  return Object.fromEntries(pids.map((p) => [p, v[p] / S.citizens.length * 100]));
}

export function runPresidentialElection(S) {
  const pol = S.pol;
  const cands = campaignCandidates(S);
  const pids = cands.map((c) => c.party);
  let r1 = tally(S, pids, { presidential: true });
  const sorted = [...pids].sort((a, b) => r1.share[b] - r1.share[a]);
  let final = r1, runoff = null;
  if (r1.share[sorted[0]] < 50) { runoff = tally(S, sorted.slice(0, 2), { presidential: true }); final = runoff; }
  const winner = Object.keys(final.share).sort((a, b) => final.share[b] - final.share[a])[0];
  const won = winner === S.player.partyId;
  pol.lastResult = { kind: 'presidential', day: S.day, round1: r1, runoff, winner, won, cands };
  pol.campaign = null;
  pol.nextPresElection = S.day + 1461;
  const pres = president(S);
  if (won) {
    const firstTerm = pol.phase === 'candidate';
    pol.phase = 'governing'; pol.terms += 1; pol.mood = 0.06; pol.capital = Math.max(pol.capital, 60);
    if (firstTerm) {
      // first election also elects parliament
      runParliamentElection(S, true);
      autoFillCabinet(S);
      if (!pol.cabinet.vp) autoFillCabinet(S);
    }
    news(S, 'Election', `${pres.name} ${firstTerm ? 'elected' : 're-elected'} President with ${final.share[winner].toFixed(1)}%`, `${runoff ? 'After a run-off, ' : ''}${pres.name} of the ${partyName(winner)} won the presidency. Turnout: ${final.turnout.toFixed(1)}%.`, { imp: 3, tone: 1 });
  } else {
    pol.phase = 'gameover';
    pol.gameOverReason = `Defeated in the presidential election by ${S.chars[S.parties[winner].leader]?.name} (${partyName(winner)}).`;
    news(S, 'Election', `${S.chars[S.parties[winner].leader]?.name} wins presidency`, `${pres.name} concedes defeat after winning ${final.share[S.player.partyId]?.toFixed(1) ?? '—'}% of the vote.`, { imp: 3, tone: -1 });
  }
  S.pending.push({ type: 'electionResult', data: {} });
}

export function runParliamentElection(S, silent = false) {
  const pol = S.pol;
  const pids = PARTIES.map((p) => p.id);
  const r = tally(S, pids, {});
  // largest remainder with 4% threshold
  const eligible = pids.filter((p) => r.share[p] >= 4);
  const tot = sum(eligible.map((p) => r.share[p]));
  const quotas = eligible.map((p) => ({ p, q: r.share[p] / tot * SEATS }));
  let alloc = Object.fromEntries(pids.map((p) => [p, 0]));
  quotas.forEach((x) => (alloc[x.p] = Math.floor(x.q)));
  let left = SEATS - sum(Object.values(alloc));
  quotas.sort((a, b) => (b.q % 1) - (a.q % 1)).forEach((x) => { if (left > 0) { alloc[x.p]++; left--; } });
  for (const p of pids) S.parties[p].seats = alloc[p];
  pol.nextParlElection = S.day + (silent ? 730 : 1461);
  if (!silent) pol.campaign = null;
  // rebuild coalition if needed: keep partners, then the player must manage it
  const seats = coalitionSeats(S);
  const res = { kind: 'parliamentary', day: S.day, share: r.share, seats: alloc, turnout: r.turnout, won: alloc[S.player.partyId] > 0 };
  if (!silent) {
    pol.lastResult = res;
    news(S, 'Election', `Parliamentary election: ${partyName(pids.sort((a, b) => alloc[b] - alloc[a])[0])} wins most seats`, PARTIES.map((p) => `${p.short} ${alloc[p.id]}`).join(' · ') + `. Governing coalition: ${seats} seats.`, { imp: 3 });
    S.pending.push({ type: 'electionResult', data: {} });
  } else pol.lastParl = res;
  return res;
}

export function monthlyParliamentAfterFirst(S) { /* reserved for expansion */ }
