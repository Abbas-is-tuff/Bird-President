// News & media: every headline is produced from something that actually happened in the simulation.
import { OUTLETS } from './data.js';
import { pick, rand, chance, pct, fmtMoney, signed } from './util.js';

const MAX_NEWS = 260;

export function news(S, cat, headline, body, opts = {}) {
  const outlet = opts.outlet || (opts.intl ? 'wws' : pick(S, ['herald', 'herald', 'nest', 'canopy', 'biz']));
  const item = { id: S.day + '-' + Math.floor(rand(S) * 1e6), day: S.day, cat, headline, body, outlet, imp: opts.imp ?? 1, tone: opts.tone ?? 0 };
  S.news.unshift(item);
  if (S.news.length > MAX_NEWS) S.news.length = MAX_NEWS;
  if ((opts.imp ?? 1) >= 2) toast(S, headline, cat, opts.tone);
  return item;
}

// Same story told three ways: right-leaning, left-leaning and neutral outlets pick their framing.
export function slanted(S, cat, v, body, opts = {}) {
  const outlet = opts.outlet || pick(S, ['herald', 'nest', 'canopy', 'biz']);
  const o = OUTLETS.find((x) => x.id === outlet);
  const h = o.slant > 0.5 && v.right ? v.right : o.slant < -0.5 && v.left ? v.left : v.neutral;
  return news(S, cat, h, body, { ...opts, outlet });
}

export function toast(S, text, cat = 'info', tone = 0) {
  S.toasts.push({ text, cat, tone, day: S.day });
  if (S.toasts.length > 20) S.toasts.shift();
}

export const outletName = (id) => (OUTLETS.find((o) => o.id === id) || OUTLETS[0]).name;

// Monthly economic bulletin built from the actual indicators.
export function monthlyEconomyNews(S) {
  const c = S.countries[0], e = c.econ, h = S.history;
  const prev = h.length > 1 ? h[h.length - 2] : null;
  const name = c.short;
  if (prev) {
    const dInf = e.inflation - prev.inflation;
    if (Math.abs(dInf) > 0.35) {
      slanted(S, 'Economy', {
        neutral: `Inflation ${dInf > 0 ? 'climbs' : 'eases'} to ${pct(e.inflation)}`,
        right: dInf > 0 ? `Prices soar to ${pct(e.inflation)} as government spending bites` : `Inflation cools to ${pct(e.inflation)}`,
        left: dInf > 0 ? `Families squeezed as inflation hits ${pct(e.inflation)}` : `Relief for households: inflation falls to ${pct(e.inflation)}`,
      }, `Consumer prices in ${name} are rising at an annual rate of ${pct(e.inflation)}, ${dInf > 0 ? 'up' : 'down'} from ${pct(prev.inflation)} last month. The central bank policy rate stands at ${pct(e.rate, 2)}.`, { imp: Math.abs(dInf) > 1 ? 2 : 1 });
    }
    const dU = e.unemployment - prev.unemployment;
    if (Math.abs(dU) > 0.25) {
      slanted(S, 'Economy', {
        neutral: `Unemployment ${dU > 0 ? 'rises' : 'falls'} to ${pct(e.unemployment)}`,
        right: dU > 0 ? `Job losses mount: unemployment at ${pct(e.unemployment)}` : `Hiring picks up, unemployment ${pct(e.unemployment)}`,
        left: dU > 0 ? `Workers left behind as joblessness reaches ${pct(e.unemployment)}` : `Labour market improves; unemployment ${pct(e.unemployment)}`,
      }, `The national statistics office reports unemployment at ${pct(e.unemployment)}, compared with ${pct(prev.unemployment)} a month earlier. Economic growth is running at ${pct(e.growth)} annualised.`, { imp: Math.abs(dU) > 0.8 ? 2 : 1 });
    }
    if (prev.growth > 0 && e.growth < 0) news(S, 'Economy', `${name} economy contracts — recession fears grow`, `Output is now shrinking at ${pct(e.growth)} a year. Business confidence has dropped to ${e.confidence.toFixed(0)}/100.`, { imp: 2, tone: -1, outlet: 'biz' });
    if (prev.growth < 0 && e.growth > 0.3) news(S, 'Economy', `Economy returns to growth`, `GDP is expanding again at ${pct(e.growth)}. Analysts credit ${e.gap > 0 ? 'stronger demand' : 'improving productivity'}.`, { imp: 2, tone: 1, outlet: 'biz' });
  }
  const dp = e.debt / e.gdp * 100;
  if (dp > 100 && chance(S, 0.15)) news(S, 'Economy', `Debt passes ${dp.toFixed(0)}% of GDP; ratings agencies issue warning`, `National debt now stands at ${fmtMoney(e.debt)}. Interest costs reached ${fmtMoney(e.interest)} a year.`, { outlet: 'biz', tone: -1 });
}

// Interviews: a politician comments on the most pressing issue.
export function interview(S) {
  const pol = S.pol;
  const e = S.countries[0].econ;
  const rivals = Object.values(S.parties).filter((p) => p.id !== S.player.partyId && p.leader && S.chars[p.leader]);
  if (!rivals.length) return;
  const p = pick(S, rivals), ch = S.chars[p.leader];
  let topic, quote;
  if (e.inflation > 4.5) { topic = 'cost of living'; quote = `Every family can see prices rising at ${pct(e.inflation)}. This government has lost control of the economy.`; }
  else if (e.unemployment > 8) { topic = 'jobs'; quote = `${pct(e.unemployment)} unemployment is not a statistic, it is a crisis in every nest across this country.`; }
  else if (pol.approval < 38) { topic = 'leadership'; quote = `Only ${pol.approval.toFixed(0)}% of citizens trust the President. It is time for new leadership.`; }
  else if (S.wars.some((w) => w.a === 0 || w.b === 0)) { topic = 'war'; quote = `Our soldiers deserve a clear plan, not slogans.`; }
  else if (e.debt / e.gdp > 0.9) { topic = 'debt'; quote = `We are borrowing from our chicks' future. Debt is at ${(e.debt / e.gdp * 100).toFixed(0)}% of GDP.`; }
  else { topic = 'reform'; quote = pick(S, [`The President talks well, but where are the results?`, `Our party will be ready to govern when the people ask.`, `We support the government when it is right. Too often it is not.`]); }
  news(S, 'Interview', `Interview: ${ch.name} (${p.id.toUpperCase()}) on ${topic}`, `“${quote}” — ${ch.name}, leader of the ${partyName(p.id)}, speaking to ${outletName('herald')}.`, { outlet: 'herald', tone: -0.5 });
}

import { PARTIES } from './data.js';
export const partyName = (id) => (PARTIES.find((p) => p.id === id) || {}).name || id;
export const partyColor = (id) => (PARTIES.find((p) => p.id === id) || {}).color || '#888';
export { signed };
