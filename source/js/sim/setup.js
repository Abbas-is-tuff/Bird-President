// Builds a fresh game state. Everything here is JSON-serialisable (save/load = JSON).
import { CORE_CHARS, NPC_NAMES, PALETTES, NPC_SPECIES, PARTIES, COUNTRIES, DEFAULT_BUDGET, DEFAULT_TAXES, POSITIONS, LOOKS } from './data.js';
import { rand, randRange, randInt, pick, gauss, clamp } from './util.js';
import { createCitizens } from './citizens.js';

export function makeEcon(c) {
  const gdp = c.gdp;
  return {
    gdp, growth: 1.8, gap: 0, inflation: 2.3, expInfl: 2.2, unemployment: 6.0, debt: gdp * c.debtPct / 100,
    revenue: 0, spending: 0, interest: 0, deficit: 0, debtRate: 3.2, rate: 3.0, rateTarget: 3.0, currency: 100,
    exports: gdp * c.exportShare, imports: gdp * c.importShare, priceLevel: 1, wage: 1, col: 100, pop: c.pop,
    popGrowth: 0.6, confidence: 55, shock: 0, inflShock: 0, gStar: 1.6, uStar: 5.5, moodShock: 0,
  };
}

function makeLeader(S, base) {
  return { ...base, termStart: 0 };
}

export function newGame(opts = {}) {
  const seed = opts.seed ?? (Date.now() % 2147483647);
  const S = { version: 1, rng: seed >>> 0, mapSeed: 1337, day: 0, speed: 0, log: [], pending: [], news: [], proposals: [], toasts: [], history: [], flags: {}, settingsSnapshot: null };
  S.player = {
    birdId: opts.birdId || 'abbas',
    partyId: opts.partyId || 'unity',
    countryName: opts.countryName || 'Republic of Aviania',
    difficulty: opts.difficulty || 'normal',
  };

  // Characters
  S.chars = {};
  for (const c of CORE_CHARS) S.chars[c.id] = { ...c, look: c.id, party: null, role: null, status: 'active', scandals: 0 };
  NPC_NAMES.forEach(([name, spec], i) => {
    const pal = PALETTES[i % PALETTES.length];
    const id = 'npc' + i;
    S.chars[id] = {
      id, name, species: NPC_SPECIES[pal.type] || 'Bird', specialty: spec, look: 'pal' + (i % PALETTES.length),
      competence: randInt(S, 48, 88), charisma: randInt(S, 40, 85), integrity: randInt(S, 35, 92), loyalty: randInt(S, 40, 85), ambition: randInt(S, 30, 90),
      econ: clamp(gauss(S) * 0.45, -1, 1), social: clamp(gauss(S) * 0.45, -1, 1), trait: pick(S, ['Steady hand', 'Policy wonk', 'Party loyalist', 'Media darling', 'Old-school operator', 'Technocrat', 'Firebrand', 'Quiet fixer']),
      bio: '', party: null, role: null, status: 'active', scandals: 0,
    };
  });
  // Party affiliations
  const pid = S.player.partyId;
  const others = PARTIES.map((p) => p.id).filter((p) => p !== pid);
  S.chars[S.player.birdId].party = pid;
  for (const id of ['abbas', 'cookie', 'snowflake', 'pikachu']) if (id !== S.player.birdId) S.chars[id].party = pid;
  // Silver leads the strongest rival party
  const rivalParty = pid === 'nest' ? 'free' : 'nest';
  if (S.player.birdId === 'silver') { S.chars.abbas.party = rivalParty; } else { S.chars.silver.party = rivalParty; }
  const npcIds = Object.keys(S.chars).filter((k) => k.startsWith('npc'));
  npcIds.forEach((id, i) => {
    const ch = S.chars[id];
    // pick party closest to ideology, with some spread
    let best = null, bd = 9;
    for (const p of PARTIES) { const d = Math.hypot(p.econ - ch.econ, p.social - ch.social) + rand(S) * 0.4; if (d < bd) { bd = d; best = p.id; } }
    ch.party = i < 3 ? pid : best;
  });

  // Parties state
  const rivalLeader = S.player.birdId === 'silver' ? 'abbas' : 'silver';
  S.parties = {};
  for (const p of PARTIES) {
    let leader = null;
    if (p.id === pid) leader = S.player.birdId;
    else if (p.id === rivalParty) leader = rivalLeader;
    else leader = npcIds.find((id) => S.chars[id].party === p.id && !Object.values(S.parties).some((q) => q.leader === id)) || null;
    if (!leader) { const free = npcIds.find((id) => S.chars[id].party !== pid && !Object.values(S.parties).some((q) => q.leader === id)); leader = free; if (free) S.chars[free].party = p.id; }
    S.parties[p.id] = { id: p.id, seats: 0, poll: 0, popularity: 0, leader, funds: 40, relation: p.id === pid ? 80 : 30 };
  }
  S.parties[rivalParty].popularity = 0.5; S.parties[pid].popularity = -0.08;
  const initialSeats = { unity: 62, nest: 66, free: 28, canopy: 22, talon: 22 };
  // Rotate seat table so the player's party sits in opposition start (realistic "outsider" campaign)
  for (const p of PARTIES) S.parties[p.id].seats = initialSeats[p.id];

  // Countries
  S.countries = COUNTRIES.map((c, i) => ({
    id: c.id, idx: i, name: i === 0 ? S.player.countryName : c.name, short: i === 0 ? S.player.countryName.replace(/^Republic of /, '') : c.short,
    adj: c.adj, gov: c.gov, capital: c.capital, color: c.color, flag: c.flag, isPlayer: i === 0, species: c.species,
    leader: i === 0 ? null : makeLeader(S, c.leader), nextElection: c.gov === 'democracy' || c.gov === 'federation' ? randInt(S, 200, 1400) : null,
    econ: makeEcon(c), budget: { ...DEFAULT_BUDGET, defense: c.leader ? 1.6 + c.leader.aggression * 2.2 : 2.0 }, taxes: { ...DEFAULT_TAXES },
    exportShare: c.exportShare, importShare: c.importShare, basePop: i === 7 ? 1.4 : 0.5, stability: 65, corruption: i === 1 ? 35 : 18, credibility: 0.5, tech: i === 1 || i === 3 ? 1 : 0.5,
    cbIndependent: true, mods: {},
    mil: makeMil(S, c),
  }));
  // Relations matrix (symmetric), embassies, treaties
  const n = S.countries.length;
  S.rel = Array.from({ length: n }, () => Array(n).fill(0));
  const base = { corvid: -25, psitt: 40, strigia: 30, falcon: -5, anser: 35, pelican: 25, passer: 12 };
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) {
    let r;
    if (a === 0) r = base[S.countries[b].id];
    else {
      const la = S.countries[a].leader, lb = S.countries[b].leader;
      r = 30 - Math.hypot(la.econ - lb.econ, la.social - lb.social) * 30 - (la.aggression + lb.aggression) * 15 + randRange(S, -10, 10);
    }
    S.rel[a][b] = S.rel[b][a] = Math.round(r);
  }
  S.embassy = Array.from({ length: n }, (_, a) => Array.from({ length: n }, (_, b) => a !== b));
  S.treaties = [
    { type: 'trade', a: 0, b: 2, since: 0 },
    { type: 'alliance', a: 1, b: 4, since: 0 },
    { type: 'alliance', a: 3, b: 5, since: 0 },
    { type: 'trade', a: 3, b: 5, since: 0 },
    { type: 'trade', a: 2, b: 6, since: 0 },
    { type: 'nonaggression', a: 0, b: 5, since: 0 },
  ];
  S.sanctions = [];
  S.wars = [];
  S.disputes = [
    { id: 'featherridge', name: 'Feather Ridge', a: 0, b: 1, tension: 38, holder: null, resolved: false },
    { id: 'talonpass', name: 'Talon Pass', a: 3, b: 4, tension: 30, holder: null, resolved: false },
    { id: 'coralshoals', name: 'Reedwater Delta', a: 2, b: 7, tension: 18, holder: null, resolved: false },
  ];
  S.worldRate = 3.0;
  S.nextSummit = 150;

  // Domestic politics
  S.pol = {
    phase: 'candidate', // candidate (first campaign) -> governing -> gameover
    approval: 50, mood: 0, capital: 50, media: 50, terms: 0,
    coalition: [pid], cabinet: Object.fromEntries(POSITIONS.map((p) => [p.id, null])),
    bills: [], activeLaws: [], orders: [], emergency: null, scandals: [], investigations: [], voteLog: [],
    nextPresElection: 45, nextParlElection: 45 + 730, campaign: null, lastResult: null, protest: null, strikes: [],
    lowApprovalMonths: 0, pressCooldown: 0, speechCooldown: 0, budgetBill: null, stance: { econ: 0, social: 0 },
  };
  startCampaign(S, 'presidential');

  // Citizens
  S.citizens = createCitizens(S, 1200);
  S.weather = { kind: 'clear', intensity: 0, until: 0 };
  S.kpis = {};
  return S;
}

function makeMil(S, c) {
  const ag = c.leader ? c.leader.aggression : 0.35;
  const def = c.leader ? 1.6 + ag * 2.2 : 2.0;
  const spend = c.gdp * def / 100, cap = spend * 3.6;
  const alloc = c.island ? { ground: 0.25, air: 0.3, navy: 0.45 } : { ground: 0.42, air: 0.35, navy: 0.23 };
  return {
    personnel: Math.round(spend * 4), ground: cap * alloc.ground, air: cap * alloc.air, navy: cap * alloc.navy,
    readiness: 55, readinessTarget: 55, border: 50, alloc, research: null, done: [], deployed: false, exercises: 0, mobilized: false,
  };
}

export function startCampaign(S, kind) {
  S.pol.campaign = { kind, daysLeft: kind === 'presidential' ? S.pol.nextPresElection - S.day : S.pol.nextParlElection - S.day, momentum: {}, funds: 30, cityBoost: {}, pledges: [], debateDone: false, actionsToday: 0, lastActionDay: -1 };
}
