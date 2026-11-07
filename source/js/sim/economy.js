// Macro-economic model run weekly for every country.
// A compact New-Keynesian-flavoured model: potential growth from investment in people & infrastructure,
// an output gap driven by fiscal stance, real interest rates, confidence and trade; a Phillips curve for
// inflation, Okun's law for unemployment, a Taylor rule central bank and a currency driven by rate
// differentials, trade balance and debt.
import { clamp, sum } from './util.js';
import { LAWS, ORDERS, BUDGET_KEYS } from './data.js';
import { sanctionsOn, treatiesOf, atWar } from './diplomacy.js';
import { deptEfficiency } from './government.js';

const ZERO_MODS = () => ({ gStar: 0, uStar: 0, infl: 0, compliance: 0, extraRev: 0, extraSpend: 0, importMod: 0, tariffRev: 0, exportBonus: 0, popGrowth: 0, confidence: 0, gap: 0, wage: 0, col: 0, credibility: 0, corruptionDelta: 0, corpTaxDelta: 0 });

// Aggregate modifiers from laws, executive orders, emergencies, wars and events for a country.
export function computeMods(S, c) {
  const m = ZERO_MODS();
  if (c.isPlayer) {
    for (const id of S.pol.activeLaws) {
      const L = LAWS.find((l) => l.id === id); if (!L) continue; const f = L.fx;
      m.gStar += f.gStar || 0; m.uStar += f.uStar || 0; m.infl += f.infl || 0; m.compliance += f.compliance || 0;
      m.extraRev += f.extraRev || 0; m.importMod += f.importMod || 0; m.tariffRev += f.tariffRev || 0; m.popGrowth += f.popGrowth || 0;
      m.confidence += f.confidence || 0; m.wage += f.wage || 0; m.col += f.col || 0; m.credibility += f.credibility || 0; m.corpTaxDelta += f.corpTaxDelta || 0;
      m.extraSpend += (f.spendHealth || 0) + (f.spendInfra || 0) + (f.spendSecurity || 0) + (f.spendEducation || 0) + (f.spendWelfare || 0) + (f.spendAdmin || 0);
      if (f.eduBoost) m.gStar += 0.15;
    }
    for (const o of S.pol.orders) {
      if (o.id === 'freeze') { m.extraSpend -= 0.3; m.uStar += 0.2; }
      if (o.id === 'pricecap') { m.infl -= 1.0; m.gStar -= 0.2; }
      if (o.id === 'reserves') { m.infl -= 0.3; }
      if (o.id === 'borderlock') { m.importMod -= 0.04; m.exportBonus -= 0.03; }
      if (o.id === 'fasttrack') { m.gStar += 0.12; }
      if (o.id === 'paybump') { m.extraSpend += 0.3; m.wage += 0.3; }
      if (o.id === 'stimulus') { m.extraSpend += 0.6; m.gap += 1.4; }
      if (o.id === 'curfew') { m.confidence -= 6; m.gStar -= 0.4; }
    }
    if (S.pol.emergency) { m.extraSpend += 0.4; m.confidence -= 2; }
    // Ministers: finance -> compliance, trade -> exports
    const ef = deptEfficiency(S, 'finance'), et = deptEfficiency(S, 'trade');
    m.compliance += (ef - 1) * 0.08; m.exportBonus += (et - 1) * 0.15; m.gStar += (ef - 1) * 0.4;
    const mil = c.mil;
    if (mil.readiness > 60) m.extraSpend += (mil.readiness - 60) * 0.012;
    if (mil.mobilized) { m.extraSpend += 0.8; m.gStar -= 0.3; m.uStar -= 0.5; }
  } else if (c.mil.mobilized) { m.extraSpend += 0.8; m.gStar -= 0.3; }
  const wars = atWar(S, c.idx);
  if (wars.length) { m.extraSpend += 1.6 * wars.length; m.gStar -= 1.2 * wars.length; m.confidence -= 8; m.popGrowth -= 0.2; }
  c.mods = m;
  return m;
}

export function taxEffective(c) {
  const t = c.taxes, m = c.mods || {};
  const corp = Math.max(0, t.corporate + (m.corpTaxDelta || 0));
  return (t.income * 0.45 + corp * 0.15 + t.sales * 0.55) / 100;
}

// Preview revenue/spending for a hypothetical budget (used by UI sliders).
export function projectBudget(S, c, budget, taxes) {
  const e = c.econ, m = c.mods || ZERO_MODS();
  const compliance = clamp(1.0 - c.corruption / 400 + m.compliance, 0.6, 1.03);
  const corp = Math.max(0, taxes.corporate + (m.corpTaxDelta || 0));
  const rate = (taxes.income * 0.45 + corp * 0.15 + taxes.sales * 0.55) / 100 * compliance;
  const revenue = e.gdp * (rate + m.tariffRev + m.extraRev / 100);
  const prog = e.gdp * (sum(BUDGET_KEYS.map((k) => budget[k])) + m.extraSpend) / 100;
  const spending = prog + e.debt * e.debtRate / 100;
  return { revenue, spending, deficit: spending - revenue, deficitPct: (spending - revenue) / e.gdp * 100 };
}

export function economyStep(S, c, dt) {
  const e = c.econ, b = c.budget, t = c.taxes;
  const m = computeMods(S, c);
  const debtPct = e.debt / e.gdp * 100;

  // --- Public finances ---
  const compliance = clamp(1.0 - c.corruption / 400 + m.compliance, 0.6, 1.03);
  const taxRate = taxEffective(c) * compliance + m.tariffRev + m.extraRev / 100;
  e.revenue = e.gdp * taxRate;
  e.debtRate += ((e.rate * 0.8 + 1 + Math.max(0, debtPct - 90) * 0.06) - e.debtRate) * dt * 0.6;
  e.interest = e.debt * e.debtRate / 100;
  const progSpend = e.gdp * (sum(BUDGET_KEYS.map((k) => b[k])) + m.extraSpend) / 100;
  e.spending = progSpend + e.interest;
  e.deficit = e.spending - e.revenue;
  e.debt = Math.max(0, e.debt + e.deficit * dt);
  const deficitPct = e.deficit / e.gdp * 100;
  const taxBurden = taxRate * 100;

  // --- Supply side ---
  const eduEff = c.isPlayer ? deptEfficiency(S, 'education') : 1;
  const sanc = sanctionsOn(S, c.idx).length;
  e.gStar = 1.35 + 0.22 * (b.education * eduEff - 4) + 0.28 * (b.infrastructure - 2.5) + 0.45 * (b.research - 0.7) + 0.25 * c.tech
    + e.popGrowth * 0.5 - c.corruption * 0.015 - 0.07 * (taxBurden - 20) + m.gStar - sanc * 0.5;
  e.gStar = clamp(e.gStar, -3, 6);

  // --- Demand side ---
  const tb = (e.exports - e.imports) / e.gdp * 100;
  const realRate = e.rate - e.expInfl;
  const gapTarget = clamp(0.5 * (deficitPct - 2.5) - 0.55 * (realRate - 1) + 0.06 * (e.confidence - 55) + 0.25 * tb + m.gap, -9, 9);
  e.gap += (gapTarget - e.gap) * clamp(dt * 3, 0, 1);
  e.shock *= Math.exp(-dt * 3.2);
  e.growth = e.gStar + 0.55 * e.gap + e.shock;

  // --- Inflation (expectations-augmented Phillips curve) ---
  e.inflShock *= Math.exp(-dt * 2);
  const credibility = clamp(c.credibility + m.credibility + (c.cbIndependent ? 0.15 : -0.2), 0, 1);
  const inflTarget = e.expInfl + 0.32 * e.gap - 0.05 * (e.currency - 100) + m.infl + e.inflShock + Math.max(0, debtPct - 110) * 0.03;
  e.inflation += (inflTarget - e.inflation) * clamp(dt * 4, 0, 1);
  e.expInfl += ((e.inflation - e.expInfl) * 0.7 + (2 - e.expInfl) * 0.6 * credibility) * dt;
  e.inflation = clamp(e.inflation, -4, 60);

  // --- Central bank ---
  if (c.cbIndependent) {
    const taylor = clamp(1 + e.inflation + 0.5 * (e.inflation - 2) + 0.5 * e.gap, 0, 25);
    e.rate += (taylor - e.rate) * clamp(dt * 2.2, 0, 1);
  } else {
    e.rate += (e.rateTarget - e.rate) * clamp(dt * 6, 0, 1);
    if (e.inflation > 5) c.credibility = Math.max(0, c.credibility - dt * 0.15);
  }

  // --- Labour market (Okun) ---
  e.uStar = clamp(5.3 + m.uStar - 0.15 * (b.education - 4), 2, 15);
  const uTarget = e.uStar - 0.45 * e.gap - Math.min(0, e.shock) * 0.3;
  e.unemployment = clamp(e.unemployment + (uTarget - e.unemployment) * clamp(dt * 3, 0, 1), 1.5, 35);

  // --- Currency & trade ---
  const fxT = 100 + 4 * (e.rate - S.worldRate) + 1.2 * tb - 0.12 * (debtPct - 60) - 10 * sanc + 0.25 * (c.stability - 60) - (e.inflation - 2.5) * 1.5;
  e.currency = clamp(e.currency + (fxT - e.currency) * clamp(dt * 1.5, 0, 1), 20, 250);
  const trades = treatiesOf(S, c.idx, 'trade').length;
  const tradeMult = 1 + 0.05 * trades - 0.12 * sanc + m.exportBonus;
  e.exports = e.gdp * c.exportShare * Math.pow(100 / e.currency, 0.7) * Math.max(0.3, tradeMult);
  e.imports = e.gdp * c.importShare * Math.pow(e.currency / 100, 0.6) * (1 + e.gap / 50) * Math.max(0.3, 1 + m.importMod - sanc * 0.05);

  // --- Nominal aggregates, prices, wages ---
  e.gdp *= 1 + (e.growth + e.inflation) / 100 * dt;
  e.priceLevel *= 1 + e.inflation / 100 * dt;
  const wg = e.inflation * 0.85 + Math.max(0, e.gStar) * 0.6 - (e.unemployment - e.uStar) * 0.4 + m.wage;
  e.wage *= 1 + wg / 100 * dt;
  e.col = e.priceLevel / e.wage * 100 * (1 + m.col);

  // --- Population ---
  e.popGrowth = c.basePop + 0.05 * (b.health - 4.5) + m.popGrowth;
  e.pop *= 1 + e.popGrowth / 100 * dt;

  // --- Confidence ---
  const confT = 55 + 2.5 * (e.growth - 1.5) - 2.2 * (e.unemployment - 6) - 1.8 * Math.max(0, e.inflation - 3) + m.confidence + e.moodShock - Math.max(0, debtPct - 100) * 0.2;
  e.moodShock *= Math.exp(-dt * 2);
  e.confidence = clamp(e.confidence + (confT - e.confidence) * clamp(dt * 4, 0, 1), 0, 100);

  // --- AI country stability ---
  if (!c.isPlayer) {
    const st = 60 + (e.growth - 1.5) * 4 - (e.unemployment - 6) * 2 - Math.max(0, e.inflation - 4) * 2;
    c.stability = clamp(c.stability + (st - c.stability) * dt * 2, 0, 100);
  }
}

export const debtPct = (c) => c.econ.debt / c.econ.gdp * 100;
