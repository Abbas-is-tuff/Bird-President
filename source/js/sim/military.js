// Armed forces: budgets turn into ground/air/naval strength; readiness, research, deployments and war.
import { clamp, chance, rand, fmtMoney } from './util.js';
import { RESEARCH } from './data.js';
import { news } from './news.js';
import { deptEfficiency, isGoverning } from './government.js';
import { addRel, declareWar, warBetween, rel, allies, sidePower, WIN_SCORE } from './diplomacy.js';

export function milPower(c) {
  const m = c.mil;
  const tech = 1 + c.tech * 0.12 + m.done.length * 0.04;
  const rd = 0.4 + m.readiness / 100 * 0.6;
  return (m.ground * 1.0 + m.air * 1.35 + m.navy * 0.8) * tech * rd * (m.mobilized ? 1.25 : 1);
}

export function forceSummary(c) {
  const m = c.mil;
  return {
    personnel: Math.round(m.personnel), divisions: Math.round(m.ground / 6), aircraft: Math.round(m.air * 3.2), ships: Math.round(m.navy * 0.9),
    power: milPower(c), spend: c.econ.gdp * c.budget.defense / 100,
  };
}

export function monthlyMilitary(S) {
  for (const c of S.countries) {
    const m = c.mil, spend = c.econ.gdp * c.budget.defense / 100;
    const eff = c.isPlayer ? deptEfficiency(S, 'defense') : 1;
    const bonus = (k) => m.done.reduce((s, id) => s + ((RESEARCH.find((r) => r.id === id) || { fx: {} }).fx[k] || 0), 0);
    const cap = spend * eff * 3.6; // sustainable strength units
    const tg = cap * m.alloc.ground * (1 + bonus('ground')), ta = cap * m.alloc.air * (1 + bonus('air')), tn = cap * m.alloc.navy * (1 + bonus('navy'));
    const surge = S.wars.some((w) => w.a === c.idx || w.b === c.idx) ? 2.5 : 1; // wartime production
    m.ground += (tg - m.ground) * 0.06 * surge; m.air += (ta - m.air) * 0.05 * surge; m.navy += (tn - m.navy) * 0.04 * surge;
    const service = c.isPlayer && S.pol.activeLaws.includes('service') ? 1.5 : 1;
    const pTarget = spend * 4 * service;
    m.personnel += (pTarget - m.personnel) * 0.05;
    const rTarget = m.mobilized ? 90 : m.readinessTarget ?? 55;
    m.readiness = clamp(m.readiness + (rTarget - m.readiness) * 0.2, 10, 100);
    const bTarget = 40 + c.budget.security * 10 + bonus('border') + (m.deployed ? 15 : 0) + (c.isPlayer && S.pol.orders.some((o) => o.id === 'borderlock') ? 10 : 0);
    m.border = clamp(m.border + (bTarget - m.border) * 0.2, 0, 100);
    if (m.research) {
      const R = RESEARCH.find((r) => r.id === m.research.id);
      m.research.progress += 1 / R.months * eff;
      if (m.research.progress >= 1) {
        m.done.push(R.id); m.research = null;
        if (R.fx.tech) c.tech += R.fx.tech * 0.5;
        if (c.isPlayer) news(S, 'Defense', `Military unveils ${R.name}`, `${R.desc} The programme was completed on schedule.`, { imp: 2, tone: 1 });
      }
    } else if (!c.isPlayer && chance(S, 0.08)) {
      const opts = RESEARCH.filter((r) => !m.done.includes(r.id));
      if (opts.length) m.research = { id: opts[Math.floor(rand(S) * opts.length)].id, progress: 0 };
    }
    if (m.exercises > 0) m.exercises--;
  }
}

// ---- Player actions ----
export function setReadiness(S, v) { S.countries[0].mil.readinessTarget = clamp(v, 30, 95); return { ok: true, msg: `Readiness target set to ${v}.` }; }
export function setAlloc(S, alloc) {
  const t = alloc.ground + alloc.air + alloc.navy;
  S.countries[0].mil.alloc = { ground: alloc.ground / t, air: alloc.air / t, navy: alloc.navy / t };
  return { ok: true, msg: 'Force allocation updated.' };
}
export function startResearch(S, id) {
  const c = S.countries[0], m = c.mil, R = RESEARCH.find((r) => r.id === id);
  if (!isGoverning(S)) return { ok: false, msg: 'Only the President can approve programmes.' };
  if (m.research) return { ok: false, msg: 'A programme is already running.' };
  if (m.done.includes(id)) return { ok: false, msg: 'Already completed.' };
  c.econ.debt += R.cost; m.research = { id, progress: 0 };
  news(S, 'Defense', `Government approves ${fmtMoney(R.cost)} ${R.name} programme`, R.desc, { outlet: 'herald' });
  return { ok: true, msg: `${R.name} started (${R.months} months).` };
}
export function militaryExercise(S, near) {
  const m = S.countries[0].mil;
  if (m.exercises > 0) return { ok: false, msg: 'Exercises already under way.' };
  if (S.pol.capital < 4) return { ok: false, msg: 'Needs 4 political capital.' };
  S.pol.capital -= 4; m.exercises = 2; m.readiness = clamp(m.readiness + 8, 0, 100);
  S.countries[0].econ.debt += S.countries[0].econ.gdp * 0.0005;
  if (near != null) {
    addRel(S, 0, near, -6);
    const d = S.disputes.find((x) => !x.resolved && (x.a === near || x.b === near) && (x.a === 0 || x.b === 0));
    if (d) d.tension = clamp(d.tension - 6, 0, 100); // deterrence
  }
  news(S, 'Defense', near != null ? `Large-scale military exercises near ${S.countries[near].short} border` : 'Armed forces hold national readiness exercises', 'Thousands of troops and dozens of aircraft took part.', { imp: 2 });
  return { ok: true, msg: 'Exercises launched. Readiness +8.' };
}
export function toggleDeploy(S) {
  const m = S.countries[0].mil; m.deployed = !m.deployed;
  const d = S.disputes.find((x) => !x.resolved && (x.a === 0 || x.b === 0));
  if (d && m.deployed) { const o = d.a === 0 ? d.b : d.a; addRel(S, 0, o, -5); }
  news(S, 'Defense', m.deployed ? 'Troops deployed to border regions' : 'Border deployment scaled back', m.deployed ? 'Additional brigades now patrol the frontier.' : 'Units are returning to their bases.');
  return { ok: true, msg: m.deployed ? 'Troops deployed to the border.' : 'Troops withdrawn.' };
}
export function toggleMobilize(S) {
  const m = S.countries[0].mil; m.mobilized = !m.mobilized;
  if (m.mobilized) { for (let i = 1; i < S.countries.length; i++) addRel(S, 0, i, -4); S.pol.mood -= 0.01; }
  news(S, 'Defense', m.mobilized ? 'President orders general mobilisation' : 'Mobilisation order lifted', m.mobilized ? 'Reservists are reporting for duty. Markets fell on the news.' : 'Reservists return to civilian life.', { imp: 3, tone: m.mobilized ? -1 : 0 });
  if (m.mobilized) S.countries[0].econ.moodShock -= 4;
  return { ok: true, msg: m.mobilized ? 'Mobilised.' : 'Demobilised.' };
}
export function playerDeclareWar(S, target) {
  if (!isGoverning(S)) return { ok: false, msg: 'Only the President can order war.' };
  if (warBetween(S, 0, target)) return { ok: false, msg: 'Already at war.' };
  if (S.pol.capital < 25) return { ok: false, msg: 'Needs 25 political capital.' };
  const d = S.disputes.find((x) => !x.resolved && ((x.a === 0 && x.b === target) || (x.b === 0 && x.a === target)));
  S.pol.capital -= 25;
  declareWar(S, 0, target, d ? `The President ordered forces into the disputed ${d.name} region.` : 'The President ordered an offensive without a formal territorial claim.');
  if (!d) S.pol.mood -= 0.06;
  // democracies sanction an aggressor
  for (let i = 1; i < S.countries.length; i++) if (i !== target && S.countries[i].gov === 'democracy' && rel(S, i, target) > 0 && chance(S, 0.5)) { S.sanctions.push({ from: i, to: 0, since: S.day }); news(S, 'Diplomacy', `${S.countries[i].short} sanctions ${S.countries[0].short} over war`, 'The sanctions target exports and state banks.', { imp: 2, tone: -1 }); }
  return { ok: true, msg: 'War declared.' };
}

// ---- Wartime commands (player) ----
export const WAR_ORDERS = {
  offensive: { name: 'Launch ground offensive', pc: 6, cd: 14, desc: 'Big push on the front. Costs readiness.' },
  airstrike: { name: 'Air strikes', pc: 4, cd: 10, desc: 'Precision strikes; stronger with a big air force. 0.1% of GDP.' },
  allies: { name: 'Call on allies', pc: 5, cd: 30, desc: 'Allies and friendly nations may join the war.' },
  warbudget: { name: 'Emergency war budget', pc: 8, cd: 60, desc: 'Defense +1.5% of GDP immediately, no parliament vote.' },
};
export function warOrder(S, enemy, id) {
  const w = warBetween(S, 0, enemy); if (!w) return { ok: false, msg: 'Not at war.' };
  const O = WAR_ORDERS[id], c = S.countries[0], m = c.mil;
  w.cd = w.cd || {};
  if ((w.cd[id] || 0) > S.day) return { ok: false, msg: `Available again in ${w.cd[id] - S.day} days.` };
  if (S.pol.capital < O.pc) return { ok: false, msg: `Needs ${O.pc} political capital.` };
  S.pol.capital -= O.pc; w.cd[id] = S.day + O.cd;
  const side = w.a === 0 ? 1 : -1;
  const ratio = sidePower(S, w, w.a === 0 ? 'a' : 'b') / Math.max(1, sidePower(S, w, w.a === 0 ? 'b' : 'a'));
  const E = S.countries[enemy];
  if (id === 'offensive') {
    const gain = (4 + 5 * m.readiness / 100) * Math.min(1.5, Math.max(0.5, ratio));
    w.push = (w.push || 0) + gain * side; m.readiness = clamp(m.readiness - 8, 20, 100); w.casualties += 400 + rand(S) * 600;
    news(S, 'War', `${c.adj} forces launch major offensive against ${E.short}`, 'Armoured columns are advancing across the front line.', { imp: 2 });
    return { ok: true, msg: 'Offensive launched — expect gains over the next weeks.' };
  }
  if (id === 'airstrike') {
    const airShare = m.air / Math.max(1, m.ground + m.air + m.navy);
    const gain = 2.5 + airShare * 8 + m.done.filter((x) => ['drones', 'stealth'].includes(x)).length * 1.5;
    w.push = (w.push || 0) + gain * side; c.econ.debt += c.econ.gdp * 0.001; E.mil.air *= 0.97; E.mil.ground *= 0.98;
    news(S, 'War', `${c.adj} air force strikes ${E.adj} military targets`, 'Command centres and supply depots were hit overnight.', { imp: 2 });
    return { ok: true, msg: 'Air strikes carried out.' };
  }
  if (id === 'allies') {
    const key = w.a === 0 ? 'alliesA' : 'alliesB';
    w[key] = w[key] || [];
    const joined = [];
    for (const k of S.countries.map((x) => x.idx)) {
      if (k === 0 || k === enemy || w[key].includes(k) || warBetween(S, k, enemy)) continue;
      const allied = allies(S, 0).includes(k), r = rel(S, 0, k), withEnemy = allies(S, enemy).includes(k);
      if (withEnemy) continue;
      const p = allied ? 0.85 : r > 45 ? 0.35 + (r - 45) / 120 : r > 20 && rel(S, k, enemy) < -20 ? 0.3 : 0;
      if (chance(S, p)) { w[key].push(k); joined.push(S.countries[k].short); addRel(S, k, enemy, -25); }
    }
    if (joined.length) { news(S, 'War', `${joined.join(' and ')} ${joined.length > 1 ? 'join' : 'joins'} the war on our side`, 'Allied forces are moving to the front.', { imp: 3, tone: 1 }); return { ok: true, msg: `${joined.join(', ')} joined the war!` }; }
    return { ok: true, msg: 'No nation answered the call. Sign alliances or improve relations.' };
  }
  if (id === 'warbudget') {
    c.budget.defense = clamp(c.budget.defense + 1.5, 0, 10); m.readiness = clamp(m.readiness + 10, 0, 100);
    m.ground *= 1.08; m.air *= 1.08; m.navy *= 1.05;
    news(S, 'War', 'President signs emergency war budget', `Defense spending rises to ${c.budget.defense.toFixed(1)}% of GDP.`, { imp: 2 });
    return { ok: true, msg: 'War budget approved. Forces reinforced.' };
  }
}
export { WIN_SCORE };
