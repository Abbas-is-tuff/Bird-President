// Agent-based citizen simulation. Each agent represents population/N real citizens.
// Compact keys keep save files small:
// a age, e education 0-3, s sector 0-4 (-1 retired, -2 student), emp employed, inc annual income (k℗),
// ec/so ideology, h happiness, n needs [food,housing,health,safety,freedom], p party, ap approval 0..1,
// city, um months unemployed, worry top concern, j per-party affinity jitter, name.
import { PARTIES, CITIES, SECTORS, LAWS } from './data.js';
import { rand, randInt, gauss, clamp, pick, avg, chance } from './util.js';
import { govStance } from './politics.js';
import { deptEfficiency, isGoverning } from './government.js';
import { news } from './news.js';

const FIRST = ['Wren', 'Pip', 'Robin', 'Sky', 'Finch', 'Lark', 'Kiwi', 'Tui', 'Poppy', 'Ash', 'Juniper', 'Sorrel', 'Rook', 'Merle', 'Dove', 'Hazel', 'Fern', 'Bramble', 'Clover', 'Sage', 'Rowan', 'Teal', 'Linnet', 'Ember'];
const LAST = ['Featherstone', 'Nestor', 'Hollybrook', 'Reed', 'Thistlewood', 'Marsh', 'Pinewing', 'Brook', 'Ashby', 'Quill', 'Sparrowhawk', 'Ridley', 'Dunlin', 'Greenleaf'];
export const WORRIES = ['jobs', 'prices', 'housing', 'healthcare', 'crime', 'freedom', 'taxes', 'environment'];
const BASE_INC = [24, 34, 50, 70];
const SECTOR_MUL = [0.82, 1.0, 0.95, 1.45, 1.02];
const CITY_W = [0.3, 0.18, 0.15, 0.13, 0.13, 0.11];

export function createCitizens(S, N) {
  const list = [];
  for (let i = 0; i < N; i++) {
    const a = clamp(Math.round(18 + Math.abs(gauss(S)) * 26 + rand(S) * 10), 18, 92);
    const eRoll = rand(S);
    const e = eRoll < 0.18 ? 0 : eRoll < 0.6 ? 1 : eRoll < 0.9 ? 2 : 3;
    let s;
    if (a >= 66) s = -1; else if (a < 23 && e >= 2 && rand(S) < 0.6) s = -2;
    else { const r = rand(S); s = r < 0.06 ? 0 : r < 0.27 ? 1 : r < 0.66 ? 2 : r < 0.8 ? 3 : 4; if (s === 3 && e < 2 && rand(S) < 0.7) s = 2; }
    let cr = rand(S), city = 0; for (let k = 0; k < CITY_W.length; k++) { cr -= CITY_W[k]; if (cr <= 0) { city = k; break; } }
    const ec = clamp(gauss(S) * 0.45 + (e >= 2 ? -0.05 : 0.05) + (a > 55 ? 0.1 : -0.05) + (s === 0 ? 0.15 : 0), -1, 1);
    const so = clamp(gauss(S) * 0.45 + (a - 45) / 90 - (e - 1.5) * 0.08 + (city === 0 ? -0.12 : 0.05), -1, 1);
    list.push({
      name: pick(S, FIRST) + ' ' + pick(S, LAST), a, e, s, emp: s >= 0 ? 1 : 0, inc: 0, ec, so, h: 60, n: [70, 60, 70, 65, 70], p: 0, ap: 0.5, city, um: 0,
      worry: pick(S, WORRIES), j: PARTIES.map(() => +(gauss(S) * 0.5).toFixed(2)),
    });
  }
  // initial unemployment ~6%
  const workers = list.filter((c) => c.s >= 0);
  for (const c of workers) if (rand(S) < 0.06) c.emp = 0;
  return list;
}

const isWorker = (c) => c.s >= 0;

export function monthlyCitizens(S) {
  const c = S.countries[0], e = c.econ, b = c.budget, t = c.taxes, pol = S.pol, list = S.citizens;
  const laws = pol.activeLaws;
  const fx = (key) => laws.reduce((s, id) => s + ((LAWS.find((l) => l.id === id) || { fx: {} }).fx[key] || 0), 0);
  const orders = new Set(pol.orders.map((o) => o.id));
  const healthEff = deptEfficiency(S, 'health'), secEff = deptEfficiency(S, 'interior');

  // --- Labour market: match agents to the macro unemployment rate ---
  const workers = list.filter(isWorker);
  const unemp = workers.filter((w) => !w.emp);
  const target = Math.round(workers.length * e.unemployment / 100);
  let diff = target - unemp.length;
  if (diff > 0) {
    const emp = workers.filter((w) => w.emp).sort((x, y) => (x.e + rand(S) * 2.5 + (x.s === 4 ? 1.5 : 0)) - (y.e + rand(S) * 2.5 + (y.s === 4 ? 1.5 : 0)));
    for (let i = 0; i < diff && i < emp.length; i++) { emp[i].emp = 0; emp[i].um = 0; }
  } else if (diff < 0) {
    unemp.sort((x, y) => (y.e + rand(S) * 2) - (x.e + rand(S) * 2));
    for (let i = 0; i < -diff && i < unemp.length; i++) { unemp[i].emp = 1; if (rand(S) < 0.25) unemp[i].s = randInt(S, 1, 3); }
  }

  const stance = govStance(S);
  const presParty = S.player.partyId;
  const prog = (edu) => 0.75 + edu * 0.12; // progressive income tax
  const relief = S.flags.reliefBoost > S.day ? 8 : 0;
  const lowIncomeBoost = fx('lowIncome');
  const pensionMod = 1 + fx('pension');
  const welfareF = b.welfare / 5.2;
  const war = S.wars.some((w) => w.a === 0 || w.b === 0);
  const protestCity = pol.protest ? CITIES.indexOf(pol.protest.city) : -1;
  const emergency = pol.emergency;
  const crime = S.flags.crime || 0;

  for (const cz of list) {
    cz.a += 1 / 12;
    // Life cycle: retire, graduate, replace the very old with young adults (keeps N constant)
    if (cz.a > 88) { cz.a = 18 + rand(S) * 4; cz.e = rand(S) < 0.5 ? 1 : 2; cz.s = -2; cz.emp = 0; cz.ec *= 0.5; cz.so *= 0.4; }
    if (cz.s >= 0 && cz.a >= (laws.includes('pension') ? 68 : 66)) { cz.s = -1; cz.emp = 0; }
    if (cz.s === -2 && cz.a >= 23) { cz.s = randInt(S, 1, 4); cz.emp = rand(S) > e.unemployment / 100 ? 1 : 0; if (laws.includes('education') && cz.e < 3 && rand(S) < 0.3) cz.e++; }

    // Income
    const base = BASE_INC[cz.e] * e.wage;
    let gross;
    if (cz.s >= 0 && cz.emp) gross = base * SECTOR_MUL[cz.s] * (cz.s === 4 && orders.has('paybump') ? 1.04 : 1) * (cz.e === 0 ? 1 + lowIncomeBoost : 1);
    else if (cz.s >= 0) { gross = base * 0.38 * welfareF; cz.um++; }
    else if (cz.s === -1) gross = base * 0.55 * welfareF * pensionMod;
    else gross = base * 0.25;
    if (cz.emp) cz.um = 0;
    const net = gross * (1 - (t.income / 100) * prog(cz.e));
    cz.inc = gross;
    const real = net / e.priceLevel * (1 - t.sales / 220);

    // Needs
    const n = cz.n;
    n[0] = clamp(35 + real * 1.5 + fx('food') + (orders.has('reserves') ? 6 : 0) + (orders.has('pricecap') ? 5 : 0) - Math.max(0, e.inflation - 3) * 2.5 + relief, 0, 100);
    n[1] = clamp(25 + real * 1.2 + (b.infrastructure - 2.5) * 5 + fx('housing') - (e.col - 100) * 0.6 - (cz.city === 0 ? 6 : 0), 0, 100);
    n[2] = clamp(32 + b.health * 8.5 * healthEff + fx('health') - (cz.a > 62 ? 10 : 0) - (S.flags.outbreak > S.day - 90 ? 12 : 0), 0, 100);
    n[3] = clamp(48 + b.security * 14 * secEff + fx('safety') - crime + c.mil.border * 0.06 - (war ? 10 : 0) - (protestCity === cz.city ? 8 : 0) + (orders.has('borderlock') ? 3 : 0), 0, 100);
    n[4] = clamp(72 + fx('freedom') - (emergency ? 10 : 0) - (orders.has('curfew') ? 18 : 0) - (laws.includes('service') && cz.a < 30 ? 8 : 0), 0, 100);

    // Happiness
    let ht = n[0] * 0.24 + n[1] * 0.22 + n[2] * 0.18 + n[3] * 0.18 + n[4] * 0.18;
    if (cz.s >= 0 && !cz.emp) ht -= 12 + Math.min(10, cz.um);
    for (const id of laws) {
      const L = LAWS.find((l) => l.id === id); const f = L.fx;
      if (f.sectorMood && f.sectorMood[cz.s]) ht += f.sectorMood[cz.s];
      if (f.ideoMood && f.ideoMood.canopy && cz.so < -0.4) ht += f.ideoMood.canopy * 0.5;
      if (f.youthMood && cz.a < 30) ht += f.youthMood;
      if (f.pension && cz.a > 55) ht -= 6;
    }
    if (orders.has('paybump') && cz.s === 4) ht += 4;
    if (orders.has('fasttrack') && cz.so < -0.5) ht -= 3;
    ht += e.moodShock * 0.4;
    cz.h = clamp(cz.h + (ht - cz.h) * 0.45, 0, 100);

    // Worry = weakest need / circumstance
    const wv = { jobs: cz.s >= 0 && !cz.emp ? 0 : 60 - Math.max(0, e.unemployment - 5) * 6, prices: n[0], housing: n[1], healthcare: n[2], crime: n[3], freedom: n[4], taxes: 70 - (t.income - 25) * 3, environment: laws.includes('carbon') ? 80 : 62 - (cz.so < -0.5 ? 20 : 0) };
    cz.worry = Object.keys(wv).reduce((a, k) => (wv[k] < wv[a] ? k : a), 'jobs');

    // Ideology drift from lived experience
    if (cz.s >= 0 && !cz.emp) cz.ec = clamp(cz.ec - 0.006, -1, 1);
    if (cz.inc > 90) cz.ec = clamp(cz.ec + 0.002, -1, 1);
    if (n[3] < 40) cz.so = clamp(cz.so + 0.004, -1, 1);
    cz.ec = clamp(cz.ec + gauss(S) * 0.004, -1, 1); cz.so = clamp(cz.so + gauss(S) * 0.004, -1, 1);

    // Approval of the President
    if (isGoverning(S)) {
      const perf = (cz.h - 52) / 48;
      const dist = Math.hypot(cz.ec - stance.econ, cz.so - stance.social) / 2.4;
      const partisan = cz.p === PARTIES.findIndex((p) => p.id === presParty) ? 0.2 : pol.coalition.includes(PARTIES[cz.p].id) ? 0.06 : -0.08;
      const score = 0.52 + perf * 0.5 - dist * 0.5 + partisan + pol.mood + (pol.media - 50) / 600;
      cz.ap += (clamp(score, 0, 1) - cz.ap) * 0.5;
    } else cz.ap = 0.5;

    // Party identification
    let best = 0, bu = -9;
    PARTIES.forEach((P, k) => {
      let u = -Math.hypot(P.econ - cz.ec, P.social - cz.so) * 1.6 + cz.j[k] * 0.35 + (S.parties[P.id].popularity || 0);
      if (isGoverning(S) && P.id === presParty) u += (cz.ap - 0.5) * 1.1;
      if (u > bu) { bu = u; best = k; }
    });
    cz.p = best;
  }

  // --- Aggregates ---
  const N = list.length;
  pol.approval = isGoverning(S) ? avg(list.map((x) => x.ap)) * 100 : 50;
  const counts = PARTIES.map(() => 0);
  for (const cz of list) counts[cz.p]++;
  PARTIES.forEach((P, k) => (S.parties[P.id].poll = counts[k] / N * 100));
  // party popularity slowly reflects scandals & momentum (decays)
  for (const P of PARTIES) S.parties[P.id].popularity *= 0.9;

  S.kpis.happiness = avg(list.map((x) => x.h));
  S.kpis.needs = [0, 1, 2, 3, 4].map((k) => avg(list.map((x) => x.n[k])));
  S.kpis.unhappyShare = list.filter((x) => x.h < 35).length / N;
  S.kpis.worries = Object.fromEntries(WORRIES.map((w) => [w, list.filter((x) => x.worry === w).length / N * 100]));

  // Protests
  if (isGoverning(S)) {
    const cityUnhappy = CITIES.map((_, k) => { const cs = list.filter((x) => x.city === k); return cs.filter((x) => x.h < 38).length / Math.max(1, cs.length); });
    const worst = cityUnhappy.indexOf(Math.max(...cityUnhappy));
    if (!pol.protest && cityUnhappy[worst] > 0.22 && !orders.has('curfew') && chance(S, 0.55)) {
      pol.protest = { city: CITIES[worst], intensity: cityUnhappy[worst], since: S.day, cause: topWorry(list.filter((x) => x.city === worst)) };
      S.pending.push({ type: 'event', id: 'protest', data: { city: CITIES[worst], cause: pol.protest.cause } });
    } else if (pol.protest) {
      const k = CITIES.indexOf(pol.protest.city);
      pol.protest.intensity = cityUnhappy[k];
      if (cityUnhappy[k] < 0.15 || orders.has('curfew')) { news(S, 'Society', `Protests in ${pol.protest.city} wind down`, 'Crowds have dispersed and the city is returning to normal.'); pol.protest = null; }
    }
  }
}

function topWorry(list) {
  const c = {}; for (const x of list) c[x.worry] = (c[x.worry] || 0) + 1;
  return Object.keys(c).sort((a, b) => c[b] - c[a])[0] || 'prices';
}

// Segment statistics for the dashboard.
export function segments(S) {
  const L = S.citizens;
  const grp = (fn, labels) => labels.map((label, k) => {
    const g = L.filter((x) => fn(x) === k);
    const w = g.filter(isWorker);
    return { label, n: g.length, share: g.length / L.length * 100, happiness: avg(g.map((x) => x.h)), approval: avg(g.map((x) => x.ap)) * 100, employment: w.length ? w.filter((x) => x.emp).length / w.length * 100 : null, income: avg(g.map((x) => x.inc)) };
  });
  return {
    sector: grp((x) => (x.s >= 0 ? x.s : x.s === -1 ? 5 : 6), [...SECTORS, 'Retired', 'Students']),
    edu: grp((x) => x.e, ['Primary', 'Secondary', 'University', 'Postgraduate']),
    city: grp((x) => x.city, CITIES),
    age: grp((x) => (x.a < 30 ? 0 : x.a < 45 ? 1 : x.a < 65 ? 2 : 3), ['18–29', '30–44', '45–64', '65+']),
  };
}

export const sectorName = (cz) => (cz.s >= 0 ? SECTORS[cz.s] : cz.s === -1 ? 'Retired' : 'Student');
