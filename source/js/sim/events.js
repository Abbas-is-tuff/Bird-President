// Dynamic events. Each definition: when it can happen (cond), how likely (w), and either an
// automatic effect or a set of choices the President must decide on (the game pauses for those).
import { CITIES, POSITIONS, SECTORS } from './data.js';
import { clamp, chance, rand, pick, randInt, weightedPick, fmtMoney, pct } from './util.js';
import { news, slanted, toast, partyName } from './news.js';
import { isGoverning, declareEmergency, president } from './government.js';
import { addRel, declareWar, warBetween, endWar } from './diplomacy.js';
import { coalitionSeats } from './politics.js';

const P0 = (S) => S.countries[0];
const ministers = (S) => Object.entries(S.pol.cabinet).filter(([, id]) => id).map(([pos, id]) => ({ pos, ch: S.chars[id] }));

export const EVENTS = {
  recession: {
    w: (S) => 0.6 + Math.max(0, P0(S).econ.gap) * 0.4 + Math.max(0, P0(S).econ.debt / P0(S).econ.gdp - 0.9) * 2,
    auto(S) { const e = P0(S).econ; e.shock -= 1.8; e.moodShock -= 8; news(S, 'Economy', 'Global slowdown hits Aviania: orders collapse', `Factories report the sharpest drop in new orders in a decade. Analysts expect growth to fall well below ${pct(e.gStar)}.`, { imp: 3, tone: -1, outlet: 'biz' }); },
  },
  boom: {
    w: () => 0.6,
    auto(S) { const e = P0(S).econ; e.shock += 1.4; e.exports *= 1.05; e.moodShock += 6; news(S, 'Economy', 'Export boom as global demand for seed and timber surges', 'Ports report record volumes. Economists raise growth forecasts.', { imp: 2, tone: 1, outlet: 'biz' }); },
  },
  crash: {
    w: (S) => 0.35 + Math.max(0, P0(S).econ.confidence - 70) * 0.03,
    view: () => ({ title: 'Stock market crash', body: 'The Plumeria Stock Exchange fell 14% in a single session. Two major banks are reported to be in trouble. The Finance Ministry needs your decision.',
      options: [{ id: 'bailout', label: 'Bail out the banks (1% of GDP)', hint: 'Stabilises markets. Adds to debt; some voters angry.' }, { id: 'guarantee', label: 'Guarantee deposits only', hint: 'Cheaper. Markets stay nervous.' }, { id: 'none', label: 'Let the market correct', hint: 'No cost. Deeper downturn.' }] }),
    resolve(S, opt) { const e = P0(S).econ; if (opt === 'bailout') { e.debt += e.gdp * 0.01; e.shock -= 0.6; e.moodShock -= 3; S.pol.mood -= 0.01; } else if (opt === 'guarantee') { e.debt += e.gdp * 0.002; e.shock -= 1.4; e.moodShock -= 8; } else { e.shock -= 2.4; e.moodShock -= 14; S.pol.mood -= 0.015; }
      slanted(S, 'Economy', { neutral: 'Government responds to market crash', right: opt === 'bailout' ? 'Taxpayers foot the bill for bank bailout' : 'Markets left to fend for themselves', left: opt === 'none' ? 'Government abandons savers as markets plunge' : 'Bankers rescued while families struggle' }, opt === 'bailout' ? `A rescue package worth ${fmtMoney(e.gdp * 0.01)} has been announced.` : opt === 'guarantee' ? 'All deposits up to ℗100,000 are now guaranteed.' : 'The President said markets must be allowed to correct.', { imp: 3 }); },
  },
  disaster: {
    w: (S) => 0.7,
    view(S, d) { return { title: `${d.kind} strikes ${d.city}`, body: `A powerful ${d.kind.toLowerCase()} has hit ${d.city}. Early reports indicate ${d.deaths} dead and thousands of nests destroyed. Emergency services are overwhelmed.`,
      options: [{ id: 'full', label: 'Full federal response (0.4% of GDP)', hint: 'Fast recovery, strong approval boost.' }, { id: 'limited', label: 'Targeted aid only (0.1% of GDP)', hint: 'Cheaper. Risk of anger in the region.' }, { id: 'emergency', label: 'Declare a disaster emergency', hint: 'Emergency powers + full response.' }] }; },
    prep(S) { const kind = pick(S, ['Hurricane', 'Flood', 'Earthquake', 'Wildfire']); S.weather = { kind: kind === 'Wildfire' ? 'smoke' : 'storm', intensity: 1, until: S.day + 6 }; return { kind, city: pick(S, CITIES), deaths: randInt(S, 12, 240) }; },
    resolve(S, opt, d) { const e = P0(S).econ; S.flags.recentDisaster = S.day; e.shock -= 0.5;
      if (opt === 'full' || opt === 'emergency') { e.debt += e.gdp * 0.004; S.pol.mood += 0.025; if (opt === 'emergency') declareEmergency(S, 'disaster'); }
      else { e.debt += e.gdp * 0.001; S.pol.mood -= 0.02; }
      slanted(S, 'Disaster', { neutral: `${d.kind} in ${d.city}: ${d.deaths} dead`, right: opt === 'limited' ? `Anger in ${d.city} at slow federal response` : `Government mobilises for ${d.city} recovery`, left: opt === 'limited' ? `${d.city} abandoned after ${d.kind.toLowerCase()}` : `Relief pours into ${d.city}` }, `Rescue teams are working through the debris. The government has ${opt === 'limited' ? 'approved limited aid' : 'launched a full recovery operation'}.`, { imp: 3, tone: -1 }); },
  },
  outbreak: {
    w: (S) => 0.35 + (P0(S).budget.health < 4 ? 0.3 : 0),
    view: () => ({ title: 'Avian flu outbreak', body: 'A new strain of avian influenza is spreading in three provinces. The Health Ministry warns hospitals could be overwhelmed within weeks.',
      options: [{ id: 'lockdown', label: 'Impose regional lockdowns', hint: 'Stops the spread. Hits the economy hard.' }, { id: 'vaccinate', label: 'Mass vaccination campaign (0.3% GDP)', hint: 'Effective if health system is strong.' }, { id: 'downplay', label: 'Downplay the threat', hint: 'No cost now — big risk later.' }] }),
    resolve(S, opt) { const e = P0(S).econ; S.flags.outbreak = S.day;
      if (opt === 'lockdown') { e.shock -= 2.0; S.pol.mood += 0.01; } else if (opt === 'vaccinate') { e.debt += e.gdp * 0.003; e.shock -= 0.4; S.pol.mood += P0(S).budget.health > 4.5 ? 0.02 : 0; } else { if (chance(S, 0.55)) { S.pol.mood -= 0.06; e.shock -= 1.2; news(S, 'Health', 'Outbreak spirals out of control after government inaction', 'Hospitals in three provinces have run out of beds.', { imp: 3, tone: -1 }); return; } }
      news(S, 'Health', opt === 'lockdown' ? 'Lockdowns imposed to contain avian flu' : opt === 'vaccinate' ? 'Nationwide vaccination drive begins' : 'President: avian flu "under control"', 'Health officials are monitoring the situation closely.', { imp: 2 }); },
  },
  scandal: {
    cond: (S) => isGoverning(S) && ministers(S).length > 0,
    w: (S) => { const ms = ministers(S); return ms.reduce((s, m) => s + (100 - m.ch.integrity), 0) / 100 * (S.pol.activeLaws.includes('anticorr') ? 1.4 : 1) * (S.pol.activeLaws.includes('press') ? 1.2 : 1); },
    prep(S) { const ms = ministers(S); const m = weightedPick(S, ms, (x) => 110 - x.ch.integrity); const kind = pick(S, ['secret payments from a construction firm', 'using a government jet for a family holiday', 'awarding contracts to a relative', 'leaked messages insulting voters', 'undisclosed offshore accounts']); m.ch.scandals++; S.pol.scandals.push({ char: m.ch.id, day: S.day, kind }); return { char: m.ch.id, pos: m.pos, kind, guilty: rand(S) * 100 > m.ch.integrity - 15 }; },
    view(S, d) { const ch = S.chars[d.char]; return { title: `Scandal: ${ch.name}`, body: `${'The Canopy Times'} reports that ${ch.name}, ${POSITIONS.find((p) => p.id === d.pos).name}, is accused of ${d.kind}. The opposition demands a resignation.`,
      options: [{ id: 'fire', label: `Dismiss ${ch.name}`, hint: 'Ends the story. Lose a minister.' }, { id: 'inquiry', label: 'Order an independent inquiry', hint: 'Takes time; outcome uncertain.' }, { id: 'defend', label: `Stand by ${ch.name}`, hint: 'Loyalty rewarded, unless the allegations are true.' }] }; },
    resolve(S, opt, d) { const ch = S.chars[d.char];
      if (opt === 'fire') { if (S.pol.cabinet[d.pos] === ch.id) { S.pol.cabinet[d.pos] = null; ch.role = null; } S.pol.mood += 0.005; ch.loyalty -= 20; news(S, 'Scandal', `${ch.name} sacked over ${d.kind.split(' ').slice(0, 3).join(' ')} scandal`, 'The President acted swiftly, aides said.', { imp: 2 }); }
      else if (opt === 'inquiry') { S.pol.investigations.push({ char: ch.id, pos: d.pos, until: S.day + 45, guilty: d.guilty, kind: d.kind }); S.pol.mood -= 0.008; news(S, 'Scandal', `Inquiry launched into ${ch.name}`, `Investigators have 45 days to report on allegations of ${d.kind}.`, { imp: 2 }); }
      else { ch.loyalty = clamp(ch.loyalty + 15, 0, 100); S.pol.mood -= d.guilty ? 0.03 : 0.01; S.pol.media -= 5; if (d.guilty) S.pol.investigations.push({ char: ch.id, pos: d.pos, until: S.day + 30, guilty: true, kind: d.kind, defended: true }); news(S, 'Scandal', `President stands by embattled ${ch.name}`, 'Critics say the decision shows poor judgement.', { imp: 2, tone: -1 }); } },
  },
  strike: {
    cond: (S) => isGoverning(S),
    w: (S) => 0.4 + S.kpis.unhappyShare * 4 + Math.max(0, P0(S).econ.inflation - 3) * 0.2,
    prep(S) { return { sector: pick(S, [1, 2, 4, 0]) }; },
    view(S, d) { return { title: `${SECTORS[d.sector]} workers go on strike`, body: `Unions representing ${SECTORS[d.sector].toLowerCase()} workers have walked out, demanding a ${randInt(S, 6, 12)}% pay rise to keep up with prices.`,
      options: [{ id: 'meet', label: 'Meet their demands', hint: 'Ends strike. Costs money, adds inflation.' }, { id: 'mediate', label: 'Appoint a mediator', hint: 'Compromise likely, takes time.' }, { id: 'firm', label: 'Hold firm', hint: 'Saves money. Economic disruption.' }] }; },
    resolve(S, opt, d) { const e = P0(S).econ;
      if (opt === 'meet') { e.debt += e.gdp * 0.002; e.inflShock += 0.3; S.citizens.filter((c) => c.s === d.sector).forEach((c) => (c.h += 8)); }
      else if (opt === 'mediate') { e.shock -= 0.15; S.citizens.filter((c) => c.s === d.sector).forEach((c) => (c.h += 3)); }
      else { e.shock -= 0.5; S.citizens.filter((c) => c.s === d.sector).forEach((c) => (c.h -= 6)); S.pol.mood += S.player.partyId === 'nest' || S.player.partyId === 'free' ? 0.005 : -0.01; }
      news(S, 'Labour', opt === 'meet' ? `Strike ends as government agrees pay deal` : opt === 'mediate' ? 'Mediator brokers compromise in strike' : `Strike drags on as President refuses to budge`, `${SECTORS[d.sector]} workers ${opt === 'firm' ? 'remain on the picket lines' : 'return to work'}.`, { imp: 2 }); },
  },
  protest: {
    // triggered by citizen simulation
    view(S, d) { return { title: `Mass protests in ${d.city}`, body: `Tens of thousands have taken to the streets of ${d.city}, angry about ${d.cause}. Police estimate the crowd is still growing.`,
      options: [{ id: 'dialogue', label: 'Meet protest leaders', hint: 'Costs political capital, calms the city.' }, { id: 'police', label: 'Order police to clear the streets', hint: 'Restores order. Freedom concerns, anger.' }, { id: 'ignore', label: 'Ignore the protests', hint: 'May fade — or grow.' }] }; },
    resolve(S, opt, d) { const pr = S.pol.protest;
      if (opt === 'dialogue') { S.pol.capital = Math.max(0, S.pol.capital - 8); S.citizens.filter((c) => CITIES[c.city] === d.city).forEach((c) => (c.h += 6)); if (pr) pr.intensity *= 0.6; S.pol.mood += 0.008; }
      else if (opt === 'police') { S.pol.protest = null; S.pol.mood -= 0.02; S.pol.media -= 6; S.citizens.forEach((c) => (c.n[4] -= 5)); }
      slanted(S, 'Society', { neutral: `Protests in ${d.city} over ${d.cause}`, right: opt === 'police' ? `Order restored in ${d.city}` : `Mob rule in ${d.city}`, left: opt === 'police' ? `Police crack down on peaceful protesters in ${d.city}` : `${d.city} demands change` }, opt === 'dialogue' ? 'The President met organisers and promised action.' : opt === 'police' ? 'Riot police used tear gas to disperse crowds.' : 'The government has not commented.', { imp: 3, tone: -1 }); },
  },
  bordercrisis: {
    view(S, d) { const D = S.disputes.find((x) => x.id === d.dispute); const o = S.countries[D.a === 0 ? D.b : D.a]; return { title: `Border crisis in ${D.name}`, body: `${o.adj} troops have moved into positions overlooking ${D.name}. ${o.leader.name} claims the region "has always belonged to ${o.short}". Tension: ${D.tension.toFixed(0)}/100.`,
      options: [{ id: 'talks', label: 'Call for emergency talks', hint: 'Lowers tension if they are willing.' }, { id: 'deploy', label: 'Deploy troops to the border', hint: 'Deters attack; raises tension.' }, { id: 'ultimatum', label: 'Issue an ultimatum', hint: 'Bold. Could trigger war.' }] }; },
    resolve(S, opt, d) { const D = S.disputes.find((x) => x.id === d.dispute); const o = D.a === 0 ? D.b : D.a; const O = S.countries[o];
      if (opt === 'talks') { if (chance(S, 0.6 - O.leader.aggression * 0.4)) { D.tension -= 22; news(S, 'Diplomacy', `Emergency talks defuse ${D.name} crisis`, 'Both sides agreed to pull back forces.', { imp: 3, tone: 1 }); } else { D.tension += 5; news(S, 'Diplomacy', `${O.short} snubs call for talks`, `${O.leader.name} refused to send a delegation.`, { imp: 2, tone: -1 }); } }
      else if (opt === 'deploy') { S.countries[0].mil.deployed = true; D.tension += 4; S.pol.mood += 0.01; news(S, 'Defense', `Troops rushed to ${D.name}`, 'The President vowed to "defend every feather of our territory".', { imp: 3 }); }
      else { if (chance(S, 0.45 + (S.countries[0].mil.readiness - O.mil.readiness) / 200)) { D.tension -= 30; S.pol.mood += 0.03; news(S, 'Diplomacy', `${O.short} backs down after ultimatum`, 'Troops are withdrawing from the frontier.', { imp: 3, tone: 1 }); } else { declareWar(S, o, 0, `${O.short} rejected the ultimatum and attacked positions in ${D.name}.`); } }
      D.tension = clamp(D.tension, 0, 100); },
  },
  incident: {
    w: () => 0.5,
    prep(S) { return { c: randInt(S, 1, S.countries.length - 1), kind: pick(S, ['A diplomat was caught photographing a military base', 'An ambassador insulted the President on live television', 'A fishing boat was seized in disputed waters', 'Hackers traced to the country breached a ministry']) }; },
    view(S, d) { const C = S.countries[d.c]; return { title: `Diplomatic incident with ${C.short}`, body: `${d.kind}. ${C.short} denies wrongdoing.`, options: [{ id: 'expel', label: 'Expel their diplomats', hint: 'Relations −15. Looks strong.' }, { id: 'protest', label: 'Lodge a formal protest', hint: 'Relations −5.' }, { id: 'quiet', label: 'Resolve quietly', hint: 'No damage; hawks unhappy.' }] }; },
    resolve(S, opt, d) { const C = S.countries[d.c]; if (opt === 'expel') { addRel(S, 0, d.c, -15); S.pol.mood += 0.008; } else if (opt === 'protest') addRel(S, 0, d.c, -5); else S.pol.mood -= 0.004;
      news(S, 'Diplomacy', opt === 'expel' ? `${S.countries[0].short} expels ${C.adj} diplomats` : opt === 'protest' ? `Formal protest lodged with ${C.short}` : `Incident with ${C.short} resolved behind closed doors`, d.kind + '.', { imp: 2 }); },
  },
  breakthrough: {
    w: (S) => P0(S).budget.research * 0.6,
    auto(S) { const c = P0(S); c.tech = Math.min(3, c.tech + 0.12); const f = pick(S, ['battery storage', 'drought-resistant seed', 'quantum computing', 'avian vaccine', 'fusion research']); news(S, 'Science', `${c.adj} scientists announce breakthrough in ${f}`, 'Economists say the discovery could lift productivity for years.', { imp: 2, tone: 1 }); },
  },
  resignation: {
    cond: (S) => isGoverning(S) && ministers(S).some((m) => m.ch.loyalty < 55),
    w: () => 0.4,
    auto(S) { const m = pick(S, ministers(S).filter((m) => m.ch.loyalty < 55)); S.pol.cabinet[m.pos] = null; m.ch.role = null; S.pol.mood -= 0.012; news(S, 'Government', `Shock resignation: ${m.ch.name} quits as ${POSITIONS.find((p) => p.id === m.pos).name}`, `${m.ch.name} cited "${pick(S, ['personal reasons', 'fundamental disagreements with the President', 'exhaustion', 'a desire to spend more time with the flock'])}".`, { imp: 3, tone: -1 }); },
  },
  refugees: {
    cond: (S) => S.wars.some((w) => w.a !== 0 && w.b !== 0),
    w: () => 1.2,
    view: () => ({ title: 'Refugee crisis', body: 'Hundreds of thousands are fleeing a regional war. Border officials ask whether to open reception centres.', options: [{ id: 'accept', label: 'Accept refugees', hint: 'Population +, costs, international praise.' }, { id: 'limited', label: 'Accept a limited quota', hint: 'Balanced.' }, { id: 'refuse', label: 'Close the border', hint: 'Popular with nationalists; criticised abroad.' }] }),
    resolve(S, opt) { const e = P0(S).econ; if (opt === 'accept') { e.pop += 0.25; e.debt += e.gdp * 0.002; for (let i = 1; i < S.countries.length; i++) if (S.countries[i].gov === 'democracy') addRel(S, 0, i, 4); } else if (opt === 'limited') { e.pop += 0.08; e.debt += e.gdp * 0.0007; } else { S.pol.mood += S.player.partyId === 'talon' ? 0.01 : -0.004; for (let i = 1; i < S.countries.length; i++) if (S.countries[i].gov === 'democracy') addRel(S, 0, i, -3); }
      news(S, 'Society', opt === 'refuse' ? 'Government closes border to refugees' : 'Aviania opens doors to war refugees', opt === 'accept' ? 'Up to 250,000 people will be resettled.' : opt === 'limited' ? 'A quota of 80,000 has been set.' : 'Humanitarian groups condemned the decision.', { imp: 2 }); },
  },
  attack: {
    cond: (S) => isGoverning(S),
    w: () => 0.5,
    auto(S) { const ld = Object.values(S.parties).filter((p) => p.id !== S.player.partyId).sort((a, b) => b.seats - a.seats)[0]; const ch = S.chars[ld.leader]; S.pol.mood -= 0.008; S.parties[ld.id].popularity += 0.05;
      news(S, 'Politics', `${ch.name} launches blistering attack on President`, `In a speech to supporters, ${ch.name} accused the government of "${pick(S, ['incompetence', 'betraying the middle class', 'weakness abroad', 'reckless spending', 'arrogance'])}". A press conference could set the record straight.`, { imp: 2, tone: -1 }); },
  },
  cyber: {
    cond: (S) => !P0(S).mil.done.includes('cyber'),
    w: () => 0.35,
    auto(S) { const e = P0(S).econ; e.shock -= 0.3; e.moodShock -= 3; const c = pick(S, S.countries.slice(1).filter((x, i) => S.rel[0][i + 1] < 0)) || S.countries[1]; addRel(S, 0, c.idx, -6); news(S, 'Security', `Cyber attack cripples ministry systems; ${c.adj} hackers suspected`, 'Tax and benefit payments were delayed for three days. Experts urge investment in cyber defence.', { imp: 2, tone: -1 }); },
  },
  endorsement: {
    cond: (S) => isGoverning(S) && S.pol.approval > 50,
    w: () => 0.4,
    auto(S) { S.pol.mood += 0.01; news(S, 'Politics', `${pick(S, ['National Farmers Union', 'Teachers Federation', 'Chamber of Commerce', 'Nurses Association'])} praises government record`, 'The endorsement is a boost for the President.', { tone: 1 }); },
  },
  impeachment: {
    view: (S) => ({ title: 'Impeachment motion', body: `With approval at ${S.pol.approval.toFixed(0)}% the opposition has tabled a motion to remove you from office. A two-thirds majority (134 seats) is required. Your coalition holds ${coalitionSeats(S)} seats.`,
      options: [{ id: 'fight', label: 'Fight the motion in Parliament', hint: 'Spend all political capital lobbying.' }, { id: 'address', label: 'Address the nation', hint: 'Appeal directly to voters.' }] }),
    resolve(S, opt) { const pol = S.pol; const against = 200 - coalitionSeats(S) - Math.round(pol.capital / (opt === 'fight' ? 3 : 6)) - (opt === 'address' ? Math.round(president(S).charisma / 10) : 0);
      pol.capital = opt === 'fight' ? 0 : pol.capital; pol.lowApprovalMonths = 0;
      if (against >= 134) { pol.phase = 'gameover'; pol.gameOverReason = `Removed from office by an impeachment vote (${against}–${200 - against}).`; news(S, 'Politics', 'President impeached and removed from office', `Parliament voted ${against}–${200 - against}.`, { imp: 3, tone: -1 }); S.pending.push({ type: 'gameover', data: {} }); }
      else { pol.mood += 0.02; news(S, 'Politics', 'President survives impeachment vote', `Only ${against} members voted to remove, short of 134.`, { imp: 3, tone: 1 }); } },
  },
  summit: {
    view: (S) => ({ title: 'World Wing Summit', body: 'Leaders of all eight nations are gathering in Lakemere. Your delegation can champion one agenda.', options: [{ id: 'trade', label: 'Champion free trade', hint: 'Relations up with trading nations; small export boost.' }, { id: 'climate', label: 'Lead on climate action', hint: 'Relations up with democracies; Green voters pleased.' }, { id: 'security', label: 'Push a regional security pact', hint: 'Allies pleased; rivals angered.' }, { id: 'skip', label: 'Skip the summit', hint: 'Saves capital. Seen as isolationist.' }] }),
    resolve(S, opt) { for (let i = 1; i < S.countries.length; i++) { const L = S.countries[i].leader; if (opt === 'trade') addRel(S, 0, i, Math.round(L.trade * 8)); if (opt === 'climate') addRel(S, 0, i, S.countries[i].gov === 'democracy' ? 6 : -1); if (opt === 'security') addRel(S, 0, i, S.rel[0][i] > 20 ? 7 : -6); if (opt === 'skip') addRel(S, 0, i, -3); }
      if (opt === 'trade') P0(S).econ.exports *= 1.02; if (opt === 'climate') S.parties.canopy.popularity += 0.05; if (opt !== 'skip') S.pol.mood += 0.008;
      S.nextSummit = S.day + 365;
      news(S, 'Diplomacy', opt === 'skip' ? 'President skips World Wing Summit' : `President champions ${opt === 'trade' ? 'free trade' : opt === 'climate' ? 'climate action' : 'regional security'} at World Wing Summit`, 'Delegations from eight nations attended.', { imp: 2, intl: true }); },
  },
  peaceoffer: {
    view(S, d) { const E = S.countries[d.enemy]; const w = E && warBetween(S, 0, d.enemy); if (!w) return { title: 'Peace offer withdrawn', body: 'The war has already ended.', options: [{ id: 'fight', label: 'Continue' }] }; const disp = S.disputes.find((x) => !x.resolved && (x.a === d.enemy || x.b === d.enemy) && (x.a === 0 || x.b === 0)); return { title: `${E.short} sues for peace`, body: `With its armies in retreat, ${E.leader.name} offers to end the war${disp ? ` and hand over ${disp.name}` : ''}, plus reparations. Our forces hold the advantage (${(w ? (w.a === 0 ? w.score : -w.score) : 0).toFixed(0)}/${70} toward total victory).`,
      options: [{ id: 'accept', label: 'Accept their surrender', hint: disp ? `Win the war and take ${disp.name}.` : 'Win the war and collect reparations.' }, { id: 'fight', label: 'Fight on for total victory', hint: 'More casualties; bigger triumph if it works.' }] }; },
    resolve(S, opt, d) { const w = warBetween(S, 0, d.enemy); if (!w) return; if (opt === 'accept') { w.score = w.a === 0 ? 100 : -100; endWar(S, w, w.a === 0 ? 'victory' : 'defeat'); S.countries[0].econ.debt -= S.countries[d.enemy].econ.gdp * 0.01; } else { S.pol.mood += 0.005; } },
  },
  investigation: {
    // resolved from dailyEvents
  },
};

// Auto events that can fire randomly
const RANDOM = ['recession', 'boom', 'crash', 'disaster', 'outbreak', 'scandal', 'strike', 'incident', 'breakthrough', 'resignation', 'refugees', 'attack', 'cyber', 'endorsement'];

export function dailyEvents(S) {
  if (!isGoverning(S) && S.pol.phase !== 'candidate') return;
  // investigation outcomes
  for (const inv of [...S.pol.investigations]) {
    if (S.day < inv.until) continue;
    S.pol.investigations = S.pol.investigations.filter((x) => x !== inv);
    const ch = S.chars[inv.char];
    if (inv.guilty) {
      if (S.pol.cabinet[inv.pos] === ch.id) { S.pol.cabinet[inv.pos] = null; ch.role = null; }
      ch.status = chance(S, 0.5) ? 'disgraced' : 'active'; ch.integrity = Math.max(0, ch.integrity - 20);
      S.pol.mood -= inv.defended ? 0.04 : 0.015;
      news(S, 'Justice', `Inquiry finds ${ch.name} guilty of misconduct`, `Investigators confirmed ${inv.kind}. ${ch.name} has left government${ch.status === 'disgraced' ? ' and faces criminal charges' : ''}.`, { imp: 3, tone: -1 });
    } else { S.pol.mood += 0.008; ch.loyalty += 10; news(S, 'Justice', `${ch.name} cleared by independent inquiry`, 'The report found no evidence of wrongdoing.', { imp: 2, tone: 1 }); }
  }
  if (S.day >= S.nextSummit && isGoverning(S)) { S.nextSummit = S.day + 365; S.pending.push({ type: 'event', id: 'summit', data: {} }); return; }
  const diff = S.player.difficulty === 'hard' ? 1.35 : S.player.difficulty === 'easy' ? 0.7 : 1;
  const p = (isGoverning(S) ? 0.045 : 0.02) * diff;
  if (!chance(S, p)) return;
  const pool = RANDOM.filter((id) => { const E = EVENTS[id]; if (!isGoverning(S) && E.view) return false; if (E.cond && !E.cond(S)) return false; return (S.flags['ev_' + id] || -999) < S.day - 60; });
  const id = weightedPick(S, pool, (id) => Math.max(0, EVENTS[id].w ? EVENTS[id].w(S) : 1));
  if (!id) return;
  S.flags['ev_' + id] = S.day;
  fireEvent(S, id);
}

export function fireEvent(S, id) {
  const E = EVENTS[id];
  const data = E.prep ? E.prep(S) : {};
  if (E.view) S.pending.push({ type: 'event', id, data });
  else E.auto(S, data);
}

export const eventView = (S, p) => EVENTS[p.id].view(S, p.data);
export function resolveEvent(S, p, opt) {
  S.pending = S.pending.filter((x) => x !== p);
  EVENTS[p.id].resolve(S, opt, p.data);
}
