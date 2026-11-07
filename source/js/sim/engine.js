// Simulation clock. One tick = one day. Economy runs weekly; citizens, AI and diplomacy monthly.
import { isMonthStart, monthLabel, chance, rand, pick, clamp } from './util.js';
import { economyStep, computeMods } from './economy.js';
import { monthlyCitizens } from './citizens.js';
import { dailyPolitics, monthlyPolitics, govStance } from './politics.js';
import { dailyOrders, monthlyGovernment, isGoverning } from './government.js';
import { monthlyDiplomacy, weeklyWars } from './diplomacy.js';
import { monthlyMilitary } from './military.js';
import { dailyEvents } from './events.js';
import { monthlyEconomyNews, interview, news, partyName } from './news.js';

export const SPEEDS = [0, 0.6, 1.5, 4, 10]; // days per real second

export function tick(S) {
  if (S.pol.phase === 'gameover') return;
  S.day++;
  dailyPolitics(S);
  if (S.pol.phase === 'gameover') return;
  dailyOrders(S);
  dailyEvents(S);
  if (S.day % 7 === 0) {
    for (const c of S.countries) economyStep(S, c, 7 / 365);
    weeklyWars(S);
  }
  if (isMonthStart(S.day)) monthly(S);
  updateWeather(S);
}

function monthly(S) {
  govStance(S);
  monthlyCitizens(S);
  monthlyPolitics(S);
  if (isGoverning(S)) monthlyGovernment(S);
  monthlyMilitary(S);
  monthlyDiplomacy(S);
  snapshot(S);
  monthlyEconomyNews(S);
  if (chance(S, 0.45)) interview(S);
  // crime drifts with unemployment
  const u = S.countries[0].econ.unemployment;
  S.flags.crime = clamp((u - 5) * 1.5 + (S.pol.protest ? 4 : 0), 0, 25);
  // Monthly briefing from the Finance ministry
  if (isGoverning(S)) S.briefing = makeBriefing(S);
}

export function snapshot(S) {
  const c = S.countries[0], e = c.econ;
  S.history.push({
    day: S.day, label: monthLabel(S.day), gdp: e.gdp, growth: e.growth, inflation: e.inflation, unemployment: e.unemployment,
    debtPct: e.debt / e.gdp * 100, deficitPct: e.deficit / e.gdp * 100, currency: e.currency, rate: e.rate, exports: e.exports, imports: e.imports,
    col: e.col, pop: e.pop, approval: S.pol.approval, happiness: S.kpis.happiness || 60, confidence: e.confidence,
    polls: Object.fromEntries(Object.values(S.parties).map((p) => [p.id, p.poll])), power: null,
  });
  if (S.history.length > 180) S.history.shift();
}

function makeBriefing(S) {
  const c = S.countries[0], e = c.econ, items = [];
  if (e.inflation > 4) items.push({ from: 'finance', text: `Inflation is ${e.inflation.toFixed(1)}%. Consider tightening the budget or protecting central bank independence.` });
  if (e.unemployment > 8) items.push({ from: 'finance', text: `Unemployment is ${e.unemployment.toFixed(1)}%. Infrastructure or stimulus spending would support jobs.` });
  if (e.deficit / e.gdp > 0.05) items.push({ from: 'finance', text: `The deficit is ${(e.deficit / e.gdp * 100).toFixed(1)}% of GDP. Markets are watching our debt.` });
  if (S.kpis.needs && S.kpis.needs[2] < 55) items.push({ from: 'health', text: 'Hospitals are struggling. Health spending is below what citizens expect.' });
  if (S.kpis.needs && S.kpis.needs[3] < 55) items.push({ from: 'interior', text: 'Public safety concerns are rising. More police funding would help.' });
  const d = S.disputes.find((x) => !x.resolved && (x.a === 0 || x.b === 0) && x.tension > 55);
  if (d) items.push({ from: 'defense', text: `Tension over ${d.name} is ${d.tension.toFixed(0)}/100. Readiness and deterrence matter.` });
  const lowRel = S.countries.slice(1).filter((x) => S.rel[0][x.idx] < -40).map((x) => x.short);
  if (lowRel.length) items.push({ from: 'foreign', text: `Relations are hostile with ${lowRel.join(', ')}.` });
  if (!items.length) items.push({ from: 'vp', text: 'The country is stable. A good moment to pursue your legislative agenda.' });
  return { day: S.day, items };
}

function updateWeather(S) {
  const w = S.weather;
  if (S.day < w.until) return;
  const m = new Date(Date.UTC(2027, 0, 1) + S.day * 864e5).getUTCMonth();
  const winter = m === 11 || m <= 1;
  const r = rand(S);
  if (r < 0.55) S.weather = { kind: 'clear', intensity: 0, until: S.day + 2 + Math.floor(rand(S) * 5) };
  else if (r < 0.75) S.weather = { kind: 'cloudy', intensity: 0.5, until: S.day + 2 + Math.floor(rand(S) * 3) };
  else if (r < 0.95) S.weather = { kind: winter ? 'snow' : 'rain', intensity: 0.4 + rand(S) * 0.6, until: S.day + 1 + Math.floor(rand(S) * 3) };
  else S.weather = { kind: 'storm', intensity: 1, until: S.day + 1 + Math.floor(rand(S) * 2) };
}

// Run before the first tick so every derived figure exists.
export function primeState(S) {
  const d0 = S.day; const pops = Object.values(S.parties).map((p) => p.popularity);
  for (let m = 12; m >= 0; m--) {
    for (const c of S.countries) { computeMods(S, c); for (let i = 0; i < 4; i++) economyStep(S, c, 7 / 365); }
    monthlyCitizens(S);
    S.day = d0 - m * 30; snapshot(S); S.day = d0;
  }
  Object.values(S.parties).forEach((p, i) => (p.popularity = pops[i]));
  news(S, 'Election', `Presidential race begins: ${S.chars[S.player.birdId].name} launches campaign`, `With ${S.pol.nextPresElection} days until polling day, ${S.chars[S.player.birdId].name} of the ${partyName(S.player.partyId)} enters a crowded field.`, { imp: 2 });
}
