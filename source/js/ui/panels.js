// Government software panels. Each panel renders from live simulation state; every control calls a
// real simulation function through ACTIONS (data-act attributes, delegated in main.js).
import { POSITIONS, LAWS, ORDERS, RESEARCH, PARTIES, CITIES, BUDGET_KEYS, BUDGET_LABELS, OUTLETS, SECTORS } from '../sim/data.js';
import { fmtMoney, pct, signed, fmtDate, fmtPop, clamp, avg } from '../sim/util.js';
import { esc, ICONS, sparkline, lineChart, barList, hemicycle, flagDataURL, modal, confirmBox } from './dom.js';
import { portrait } from '../render/portraits.js';
import * as gov from '../sim/government.js';
import * as pol from '../sim/politics.js';
import * as dip from '../sim/diplomacy.js';
import * as mil from '../sim/military.js';
import { projectBudget, debtPct } from '../sim/economy.js';
import { segments, sectorName, WORRIES } from '../sim/citizens.js';
import { outletName, partyName, partyColor } from '../sim/news.js';

const flags = {};
const flagImg = (c) => `<img class="flag" src="${flags[c.id] || (flags[c.id] = flagDataURL(c.flag))}" alt="">`;
const img = (ch, cls = '') => `<img class="portrait ${cls}" src="${portrait(ch)}" alt="${esc(ch?.name || '')}">`;
const tone = (v, good) => (good ? 'good' : v ? 'bad' : '');
const btn = (act, label, { a = '', b = '', cls = '', dis = false, title = '' } = {}) => `<button class="btn ${cls}" data-act="${act}" data-a="${esc(a)}" data-b="${esc(b)}" ${dis ? 'disabled' : ''} ${title ? `title="${esc(title)}"` : ''}>${label}</button>`;
const governing = (S) => S.pol.phase === 'governing';
const notYet = `<div class="callout">You are still a candidate. Win the presidential election to take control of this department.</div>`;

// UI-local state (not saved)
export const ui = { tab: {}, country: 1, draft: null, newsCat: 'All', openNews: null, segTab: 'sector', lobby: false };

// ------------------------------------------------------------------ GOVERNMENT
function government(S) {
  const p = gov.president(S), party = S.parties[S.player.partyId];
  const daysToElection = S.pol.nextPresElection - S.day;
  let h = `<div class="card row">${img(p, 'lg')}<div class="grow"><div class="tiny muted">${governing(S) ? 'PRESIDENT OF THE REPUBLIC' : 'PRESIDENTIAL CANDIDATE'}</div><div class="name" style="font-size:18px">${esc(p.name)}</div><div class="small muted">${esc(p.species)} · ${esc(partyName(S.player.partyId))}</div>
    <div class="row small" style="margin-top:6px;gap:14px"><span>Approval <b class="mono">${pct(S.pol.approval, 0)}</b></span><span>Capital <b class="mono">${S.pol.capital.toFixed(0)}</b></span><span>Media <b class="mono">${S.pol.media.toFixed(0)}</b></span></div></div></div>`;
  h += `<div class="note" style="margin-bottom:6px">Next presidential election: <b>${fmtDate(S.pol.nextPresElection, true)}</b> (${daysToElection} days). Term ${Math.max(1, S.pol.terms)}.</div>`;
  if (!governing(S)) return h + notYet;
  h += `<h3>Presidential actions</h3><div class="btns">
    ${btn('meeting', 'Hold cabinet meeting')} ${btn('press', `${ICONS.mic} Press conference`, { dis: S.pol.pressCooldown > S.day, title: S.pol.pressCooldown > S.day ? `Available in ${S.pol.pressCooldown - S.day} days` : '' })}
    ${btn('speech', 'Address the nation', { dis: S.pol.speechCooldown > S.day })} ${S.pol.emergency ? btn('endEmergency', 'Lift state of emergency', { cls: 'danger' }) : btn('emergency', `${ICONS.alert} Declare national emergency`, { cls: 'danger' })}</div>`;
  if (S.pol.emergency) h += `<div class="callout bad" style="margin-top:8px">${esc(gov.EMERGENCY_TYPES[S.pol.emergency.type])} in force since ${fmtDate(S.pol.emergency.since)}. ${S.pol.emergency.justified ? 'Public supports it.' : 'Parliament may revoke it.'}</div>`;
  h += `<h3>Cabinet <span class="r tiny muted">Efficiency = competence + specialty fit</span></h3>`;
  for (const P of POSITIONS) {
    const id = S.pol.cabinet[P.id], ch = id ? S.chars[id] : null, eff = gov.deptEfficiency(S, P.id);
    h += `<div class="list-item">${ch ? img(ch) : `<div class="portrait" style="display:grid;place-items:center;color:var(--dim)">—</div>`}<div class="grow"><div class="tiny muted">${esc(P.name.toUpperCase())}</div>
      <div class="name">${ch ? esc(ch.name) : '<span class="bad">Vacant</span>'} ${ch ? `<span class="tag">${esc(partyName(ch.party).split(' ')[0])}</span>` : ''}</div>
      ${ch ? `<div class="tiny muted">Comp ${ch.competence} · Loyal ${Math.round(ch.loyalty)} · Integrity ${ch.integrity} · ${esc(ch.trait)}</div>` : ''}
      <div class="row tiny" style="margin-top:4px"><span class="muted">Dept. efficiency</span><div class="bar grow"><i style="width:${(eff - 0.6) / 0.75 * 100}%;background:${eff >= 1 ? 'var(--good)' : 'var(--warn)'}"></i></div><span class="mono">${(eff * 100).toFixed(0)}%</span></div></div>
      <div class="btns" style="flex-direction:column">${btn('appointPick', ch ? 'Replace' : 'Appoint', { a: P.id, cls: 'sm' })}${ch ? btn('fire', 'Dismiss', { a: P.id, cls: 'sm danger' }) : ''}</div></div>`;
  }
  h += `<h3>Executive orders <span class="r tiny muted">Cost: political capital</span></h3>`;
  for (const o of S.pol.orders) { const O = ORDERS.find((x) => x.id === o.id); h += `<div class="list-item"><div class="grow"><div class="name small">${esc(O.name)} <span class="tag good">In force</span></div><div class="tiny muted">${O.days > 1 ? `${o.expires - S.day} days left` : 'One-off'}${o.courtCheck ? ' · court review pending' : ''}</div></div>${O.days > 1 ? btn('revoke', 'Revoke', { a: o.id, cls: 'sm' }) : ''}</div>`; }
  for (const O of ORDERS) {
    if (S.pol.orders.some((o) => o.id === O.id)) continue;
    const err = gov.canSignOrder(S, O.id);
    h += `<div class="list-item"><div class="grow"><div class="name small">${esc(O.name)}</div><div class="tiny muted">${esc(O.desc)}${O.court ? ` Court challenge risk ${(O.court * 100).toFixed(0)}%.` : ''}</div></div>${btn('order', `Sign · ${O.pc}`, { a: O.id, cls: 'sm', dis: !!err, title: err || '' })}</div>`;
  }
  return h;
}

// ------------------------------------------------------------------ ECONOMY
function economy(S) {
  const c = S.countries[0], e = c.econ, hist = S.history;
  const tab = ui.tab.economy || 'overview';
  let h = tabs('economy', [['overview', 'Indicators'], ['budget', 'Budget & taxes'], ['trade', 'Trade & money']], tab);
  if (tab === 'overview') {
    const prev = hist.length > 1 ? hist[hist.length - 2] : null;
    const stat = (k, v, key, good, d) => `<div class="stat"><div class="k">${k}</div><div class="v ${tone(!good, good)}">${v}</div>${d != null ? `<div class="d muted">${d}</div>` : ''}<canvas data-spark="${key}"></canvas></div>`;
    h += `<div class="grid3">
      ${stat('GDP', fmtMoney(e.gdp), 'gdp', true, `℗${(e.gdp / e.pop).toFixed(1)}K per capita`)}
      ${stat('Real growth', pct(e.growth), 'growth', e.growth > 1, `potential ${pct(e.gStar)}`)}
      ${stat('Inflation', pct(e.inflation), 'inflation', e.inflation < 3.5 && e.inflation > 0.5, 'target 2.0%')}
      ${stat('Unemployment', pct(e.unemployment), 'unemployment', e.unemployment < 6.5, `natural ${pct(e.uStar)}`)}
      ${stat('Debt / GDP', pct(debtPct(c), 0), 'debtPct', debtPct(c) < 80, fmtMoney(e.debt))}
      ${stat('Budget balance', pct(-e.deficit / e.gdp * 100), 'deficitPct', e.deficit / e.gdp < 0.03, fmtMoney(-e.deficit) + '/yr')}
      ${stat('Policy rate', pct(e.rate, 2), 'rate', true, c.cbIndependent ? 'independent bank' : 'set by government')}
      ${stat('Currency index', e.currency.toFixed(1), 'currency', e.currency > 90, '100 = launch value')}
      ${stat('Cost of living', e.col.toFixed(1), 'col', e.col < 105, 'prices ÷ wages')}
      ${stat('Exports', fmtMoney(e.exports), 'exports', true, `imports ${fmtMoney(e.imports)}`)}
      ${stat('Population', fmtPop(e.pop), 'pop', true, `${signed(e.popGrowth, 2)}%/yr`)}
      ${stat('Confidence', e.confidence.toFixed(0), 'confidence', e.confidence > 50, 'business & consumer')}</div>`;
    h += `<h3>Growth, inflation & unemployment</h3><div data-chart="macro"></div>`;
    h += `<p class="note">The model links your choices to outcomes: deficits and low real interest rates push demand above potential (lower unemployment, higher inflation); education, infrastructure and research raise potential growth; high taxes and corruption lower it. The central bank follows a Taylor rule unless you take control of rates.</p>`;
  } else if (tab === 'budget') {
    if (!governing(S)) return h + notYet;
    const d = ui.draft || (ui.draft = { budget: { ...c.budget }, taxes: { ...c.taxes } });
    const pr = projectBudget(S, c, d.budget, d.taxes), now = projectBudget(S, c, c.budget, c.taxes);
    const vote = pol.predictBudget(S, d.budget, d.taxes);
    if (S.pol.budgetBill) h += `<div class="callout">A budget is before Parliament. Vote on ${fmtDate(S.pol.budgetBill.voteDay)}.</div>`;
    h += `<h3>Taxes</h3>`;
    for (const [k, lab, min, max] of [['income', 'Income tax', 10, 55], ['corporate', 'Corporate tax', 5, 45], ['sales', 'Sales tax (VAT)', 0, 30]]) h += slider(`tax.${k}`, lab, d.taxes[k], min, max, 1, '%');
    h += `<h3>Spending <span class="r tiny muted">% of GDP</span></h3>`;
    for (const k of BUDGET_KEYS) h += slider(`bud.${k}`, BUDGET_LABELS[k], d.budget[k], 0.2, k === 'defense' ? 8 : k === 'welfare' ? 12 : 9, 0.1, '');
    h += `<div class="grid3" style="margin-top:10px"><div class="stat"><div class="k">Revenue</div><div class="v">${fmtMoney(pr.revenue)}</div><div class="d ${pr.revenue >= now.revenue ? 'good' : 'bad'}">${signed(pr.revenue - now.revenue)}B</div></div>
      <div class="stat"><div class="k">Spending</div><div class="v">${fmtMoney(pr.spending)}</div><div class="d muted">${signed(pr.spending - now.spending)}B</div></div>
      <div class="stat"><div class="k">Balance</div><div class="v ${pr.deficitPct > 3 ? 'bad' : 'good'}">${pct(-pr.deficitPct)}</div><div class="d muted">of GDP</div></div></div>
      <div class="card row" style="margin-top:6px"><div class="grow small">Projected vote: <b class="mono ${vote.yes >= 101 ? 'good' : 'bad'}">${vote.yes}–${vote.no}</b> <span class="muted">(101 needed)</span></div>${btn('resetDraft', 'Reset', { cls: 'sm' })}${btn('submitBudget', 'Submit to Parliament', { cls: 'primary sm', dis: !!S.pol.budgetBill })}</div>
      <p class="note">Tax rises are unpopular and reduce household income; spending supports demand and services. Large changes are harder to pass.</p>`;
  } else {
    const tr = dip.treatiesOf(S, 0, 'trade');
    h += `<h3>Trade balance</h3><div data-chart="trade"></div>`;
    h += `<h3>Trade agreements</h3>${tr.length ? tr.map((t) => { const o = S.countries[t.a === 0 ? t.b : t.a]; return `<div class="list-item">${flagImg(o)}<div class="grow">${esc(o.name)}</div><span class="tag good">Active since ${fmtDate(t.since)}</span></div>`; }).join('') : '<p class="note">No trade agreements. Negotiate them in Diplomacy.</p>'}`;
    const sanc = dip.sanctionsOn(S, 0);
    if (sanc.length) h += `<div class="callout bad">Sanctioned by ${sanc.map((s) => esc(S.countries[s.from].short)).join(', ')}. Exports and growth are reduced.</div>`;
    h += `<h3>Central bank</h3><div class="card"><div class="row"><div class="grow"><div class="name">${c.cbIndependent ? 'Independent central bank' : 'Government-directed rates'}</div><div class="tiny muted">Policy rate ${pct(e.rate, 2)} · credibility ${(c.credibility * 100).toFixed(0)}% · world rate ${pct(S.worldRate, 2)}</div></div>${governing(S) ? btn('cbToggle', c.cbIndependent ? 'Take control' : 'Restore independence', { cls: 'sm' }) : ''}</div>
      ${!c.cbIndependent && governing(S) ? slider('rate', 'Policy rate', e.rateTarget, 0, 15, 0.25, '%') : ''}
      <p class="note" style="margin-bottom:0">Directing rates lets you stimulate the economy, but markets lose faith if inflation rises: inflation expectations drift up and the currency weakens.</p></div>`;
  }
  return h;
}
const slider = (bind, label, v, min, max, step, unit) => `<div class="slider-row"><label>${esc(label)}</label><input type="range" data-bind="${bind}" min="${min}" max="${max}" step="${step}" value="${v}"><span class="val" data-val="${bind}">${(+v).toFixed(step < 1 ? (step < 0.5 ? 2 : 1) : 0)}${unit}</span></div>`;
function tabs(panel, list, cur) { return `<div class="chip-row" style="margin-bottom:10px">${list.map(([id, l]) => `<button class="chip ${cur === id ? 'on' : ''}" data-act="tab" data-a="${panel}" data-b="${id}">${esc(l)}</button>`).join('')}</div>`; }

// ------------------------------------------------------------------ LEGISLATION
function laws(S) {
  const P = S.pol;
  const desk = P.bills.filter((b) => b.stage === 'desk'), inParl = P.bills.filter((b) => b.stage === 'parliament');
  let h = `<div class="card row"><div class="grow small">Governing coalition: <b class="mono ${pol.coalitionSeats(S) >= 101 ? 'good' : 'bad'}">${pol.coalitionSeats(S)}</b>/200 seats · Political capital <b class="mono">${P.capital.toFixed(0)}</b></div></div>`;
  if (desk.length) { h += `<h3>On your desk</h3>`; for (const b of desk) { const L = pol.lawDef(b.law); h += `<div class="card"><div class="name">${b.repeal ? 'Repeal: ' : ''}${esc(L.name)}</div><div class="tiny muted">Passed by Parliament ${b.vote ? `${b.vote.yes}–${b.vote.no}` : ''} · sponsored by ${esc(partyName(b.sponsor))} · auto-signs ${fmtDate(b.deskDeadline)}</div><p class="small">${esc(L.desc)}</p><div class="btns">${btn('signBill', 'Sign into law', { a: b.law, cls: 'primary sm' })}${btn('vetoBill', 'Veto', { a: b.law, cls: 'sm danger' })}</div></div>`; } }
  h += `<h3>Before Parliament</h3>`;
  if (!inParl.length && !P.budgetBill) h += `<p class="note">No bills under debate.</p>`;
  if (P.budgetBill) h += `<div class="list-item"><div class="grow"><div class="name small">National Budget</div><div class="tiny muted">Vote ${fmtDate(P.budgetBill.voteDay)}</div></div></div>`;
  for (const b of inParl) { const L = pol.lawDef(b.law); const pr = pol.predictVote(S, pol.lawPosition(b.law, b.repeal), { lobby: b.lobby, noPres: b.origin === 'parl' }); h += `<div class="list-item"><div class="grow"><div class="name small">${b.repeal ? 'Repeal: ' : ''}${esc(L.name)}</div><div class="tiny muted">${b.origin === 'gov' ? 'Government bill' : 'Sponsored by ' + esc(partyName(b.sponsor))} · vote ${fmtDate(b.voteDay)}</div></div><span class="tag ${pr.yes >= 101 ? 'good' : 'bad'}">Whip count ${pr.yes}–${pr.no}</span></div>`; }
  h += `<h3>Laws in force</h3>`;
  if (!P.activeLaws.length) h += `<p class="note">None of the reform acts are in force yet.</p>`;
  for (const id of P.activeLaws) { const L = pol.lawDef(id); const err = pol.canPropose(S, id, true); h += `<div class="list-item"><div class="grow"><div class="name small">${esc(L.name)}</div><div class="tiny muted">${esc(L.cat)}</div></div>${btn('repeal', 'Propose repeal', { a: id, cls: 'sm', dis: !!err, title: err || '' })}</div>`; }
  h += `<h3>Propose legislation <span class="r"><label class="tiny"><input type="checkbox" data-bind="lobby" ${ui.lobby ? 'checked' : ''}> Lobby hard (+10 capital)</label></span></h3>`;
  if (!governing(S)) return h + notYet;
  for (const L of LAWS) {
    if (P.activeLaws.includes(L.id)) continue;
    const err = pol.canPropose(S, L.id, false);
    const pr = pol.predictVote(S, { econ: L.econ, social: L.social }, { lobby: ui.lobby ? 1 : 0 });
    const lean = `${L.econ < -0.25 ? 'Left' : L.econ > 0.25 ? 'Right' : 'Centre'}${L.social < -0.3 ? ' · progressive' : L.social > 0.3 ? ' · traditional' : ''}`;
    h += `<div class="list-item"><div class="grow"><div class="name small">${esc(L.name)} <span class="tag">${esc(L.cat)}</span></div><div class="tiny muted">${esc(L.desc)} <i>${lean}</i></div><div class="tiny">Expected vote: <b class="mono ${pr.yes >= 101 ? 'good' : 'bad'}">${pr.yes}–${pr.no}</b></div></div>${btn('propose', 'Introduce', { a: L.id, cls: 'sm', dis: !!err, title: err || '' })}</div>`;
  }
  if (P.voteLog.length) { h += `<h3>Recent votes</h3>`; for (const v of P.voteLog.slice(0, 10)) h += `<div class="list-item small"><div class="grow">${esc(v.title)}<div class="tiny muted">${fmtDate(v.day)}</div></div><span class="tag ${v.passed ? 'good' : 'bad'}">${v.passed ? 'Passed' : 'Failed'} ${v.yes}–${v.no}</span></div>`; }
  return h;
}

// ------------------------------------------------------------------ POLITICS & ELECTIONS
function politics(S) {
  const P = S.pol, cp = P.campaign;
  let h = '';
  if (cp) {
    const cands = pol.campaignCandidates(S);
    const proj = pol.projectVote(S, cp.kind === 'presidential');
    h += `<div class="card" style="border-color:rgba(217,180,90,.5)"><div class="row"><div class="grow"><div class="tiny gold">${cp.kind === 'presidential' ? 'PRESIDENTIAL' : 'PARLIAMENTARY'} CAMPAIGN</div><div class="name" style="font-size:17px">${cp.daysLeft} days to polling day</div><div class="tiny muted">Campaign funds ${cp.funds.toFixed(0)} · one action per day</div></div></div>
      <div style="margin-top:8px">${cp.kind === 'presidential' ? barList(cands.map((c) => ({ label: `${S.chars[c.char]?.name || '?'} (${PARTIES.find((p) => p.id === c.party).short})`, value: proj[c.party] ?? 0, color: partyColor(c.party) })), { max: 70, fmt: (v) => pct(v) }) : barList(PARTIES.map((p) => ({ label: p.name, value: proj[p.id] ?? 0, color: p.color })), { max: 60, fmt: (v) => pct(v) })}</div>
      <div class="tiny muted">Latest voting-intention poll, including campaign momentum. Under 50% means a run-off between the top two.</div>
      <div class="row wrap" style="margin-top:10px;gap:6px"><select data-bind="rallyCity">${CITIES.map((c) => `<option>${c}</option>`).join('')}</select>${btn('campaign', 'Hold rally · 3', { a: 'rally' })}</div>
      <div class="row wrap" style="margin-top:6px;gap:6px"><select data-bind="pledge">${WORRIES.map((w) => `<option>${w}</option>`).join('')}</select>${btn('campaign', 'Make pledge · 2', { a: 'pledge' })}</div>
      <div class="btns" style="margin-top:6px">${btn('campaign', 'TV ad blitz · 8', { a: 'ads' })}${btn('campaign', 'Canvassing · 1', { a: 'doorknock' })}${btn('campaign', 'Televised debate', { a: 'debate', dis: cp.debateDone })}</div></div>`;
  }
  h += `<div class="grid2"><div class="stat"><div class="k">Approval</div><div class="v ${P.approval >= 50 ? 'good' : P.approval < 35 ? 'bad' : ''}">${pct(P.approval, 0)}</div></div><div class="stat"><div class="k">Coalition seats</div><div class="v ${pol.coalitionSeats(S) >= 101 ? 'good' : 'bad'}">${pol.coalitionSeats(S)}/200</div></div></div>`;
  h += `<div class="note" style="margin:8px 0">Presidential election ${fmtDate(P.nextPresElection, true)} · Parliamentary election ${fmtDate(P.nextParlElection, true)}</div>`;
  h += `<h3>Approval & happiness</h3><div data-chart="approval"></div>`;
  h += `<h3>Party polling</h3><div data-chart="polls"></div>`;
  h += `<h3>Parliament</h3>${hemicycle(PARTIES.map((p) => ({ seats: S.parties[p.id].seats, color: p.color })))}`;
  h += `<h3>Parties & coalition</h3>`;
  for (const p of PARTIES) {
    const st = S.parties[p.id], ldr = S.chars[st.leader], inC = P.coalition.includes(p.id), mine = p.id === S.player.partyId;
    const acc = mine || inC ? null : pol.coalitionAcceptance(S, p.id);
    h += `<div class="list-item"><span style="width:6px;align-self:stretch;border-radius:3px;background:${p.color}"></span>${ldr ? img(ldr, 'sm') : ''}<div class="grow"><div class="name small">${esc(p.name)} ${mine ? '<span class="tag gold">Your party</span>' : inC ? '<span class="tag good">Coalition</span>' : ''}</div><div class="tiny muted">${esc(p.desc)} Leader: ${esc(ldr?.name || '—')}</div><div class="tiny">Seats <b class="mono">${st.seats}</b> · Poll <b class="mono">${pct(st.poll)}</b> · Relations <b class="mono">${st.relation.toFixed(0)}</b></div></div>
      ${governing(S) && !mine ? (inC ? btn('leaveCoalition', 'Remove', { a: p.id, cls: 'sm' }) : btn('invite', `Invite · ${Math.round(acc * 100)}%`, { a: p.id, cls: 'sm' })) : ''}</div>`;
  }
  if (P.scandals.length || P.investigations.length) {
    h += `<h3>Scandals & investigations</h3>`;
    for (const i of P.investigations) h += `<div class="list-item small"><div class="grow">Inquiry into <b>${esc(S.chars[i.char].name)}</b> — ${esc(i.kind)}</div><span class="tag">reports ${fmtDate(i.until)}</span></div>`;
    for (const s of P.scandals.slice(-5).reverse()) h += `<div class="list-item small"><div class="grow">${esc(S.chars[s.char].name)}: ${esc(s.kind)}</div><span class="tiny muted">${fmtDate(s.day)}</span></div>`;
  }
  if (P.lastResult) h += `<h3>Last election</h3><div class="card small">${resultSummary(S, P.lastResult)}</div>`;
  return h;
}
export function resultSummary(S, r) {
  if (r.kind === 'presidential') {
    const f = r.runoff || r.round1;
    return `<b>Presidential election, ${fmtDate(r.day)}</b>${r.runoff ? ' (run-off)' : ''}<br>` + Object.keys(f.share).sort((a, b) => f.share[b] - f.share[a]).map((p) => `${esc(S.chars[S.parties[p].leader]?.name || p)} (${PARTIES.find((x) => x.id === p).short}) <b class="mono">${pct(f.share[p])}</b>`).join(' · ') + `<br><span class="muted">Turnout ${pct(f.turnout)}</span>`;
  }
  return `<b>Parliamentary election, ${fmtDate(r.day)}</b><br>` + PARTIES.map((p) => `${p.short} ${pct(r.share[p.id])} → <b class="mono">${r.seats[p.id]}</b>`).join(' · ');
}

// ------------------------------------------------------------------ CITIZENS
function people(S) {
  const L = S.citizens, k = S.kpis, seg = segments(S), tab = ui.segTab;
  const emp = L.filter((c) => c.s >= 0);
  let h = `<div class="grid3"><div class="stat"><div class="k">Population</div><div class="v">${fmtPop(S.countries[0].econ.pop)}</div><div class="d muted">${L.length.toLocaleString()} simulated agents</div></div>
    <div class="stat"><div class="k">Happiness</div><div class="v ${k.happiness > 60 ? 'good' : k.happiness < 45 ? 'bad' : ''}">${(k.happiness || 0).toFixed(0)}</div><div class="d muted">${pct(k.unhappyShare * 100, 0)} unhappy</div></div>
    <div class="stat"><div class="k">Employed</div><div class="v">${pct(emp.filter((c) => c.emp).length / Math.max(1, emp.length) * 100, 1)}</div><div class="d muted">of workforce</div></div></div>`;
  if (S.pol.protest) h += `<div class="callout bad" style="margin-top:8px">Protests in ${esc(S.pol.protest.city)} over ${esc(S.pol.protest.cause)} (intensity ${(S.pol.protest.intensity * 100).toFixed(0)}%).</div>`;
  h += `<h3>Needs met</h3>${barList(['Food & essentials', 'Housing', 'Healthcare', 'Safety', 'Freedom'].map((l, i) => ({ label: l, value: k.needs ? k.needs[i] : 0, color: (k.needs?.[i] ?? 0) > 60 ? '#34c38f' : (k.needs?.[i] ?? 0) > 45 ? '#e5a33b' : '#ef6461' })), { max: 100 })}`;
  h += `<h3>Top concern</h3>${barList(Object.entries(k.worries || {}).sort((a, b) => b[1] - a[1]).map(([w, v]) => ({ label: w[0].toUpperCase() + w.slice(1), value: v })), { max: 60, fmt: (v) => pct(v, 0) })}`;
  h += `<h3>Segments</h3><div class="chip-row" style="margin-bottom:6px">${[['sector', 'Occupation'], ['edu', 'Education'], ['city', 'City'], ['age', 'Age']].map(([id, l]) => `<button class="chip ${tab === id ? 'on' : ''}" data-act="segTab" data-a="${id}">${l}</button>`).join('')}</div>
    <table><tr><th>Group</th><th class="n">Share</th><th class="n">Happy</th><th class="n">Approve</th><th class="n">Employed</th><th class="n">Income</th></tr>${seg[tab].map((g) => `<tr><td>${esc(g.label)}</td><td class="n">${pct(g.share, 0)}</td><td class="n">${g.happiness.toFixed(0)}</td><td class="n">${governing(S) ? pct(g.approval, 0) : '—'}</td><td class="n">${g.employment == null ? '—' : pct(g.employment, 0)}</td><td class="n">${g.income.toFixed(0)}K</td></tr>`).join('')}</table>`;
  h += `<h3>Political landscape <span class="r tiny muted">each dot = ${Math.round(S.countries[0].econ.pop * 1e6 / L.length).toLocaleString()} citizens</span></h3><canvas data-scatter style="width:100%;height:240px;display:block;border-radius:10px;background:#0c1525"></canvas><div class="legend">${PARTIES.map((p) => `<span><i style="background:${p.color}"></i>${p.short}</span>`).join('')}<span><i style="background:#fff;border-radius:50%"></i>Government stance</span></div>`;
  h += `<h3>Meet some citizens</h3>`;
  const sample = []; for (let i = 0; i < 8; i++) sample.push(L[(i * 149 + Math.floor(S.day / 30) * 7) % L.length]);
  for (const c of sample) h += `<div class="list-item"><div class="grow"><div class="name small">${esc(c.name)}, ${Math.floor(c.a)}</div><div class="tiny muted">${esc(sectorName(c))}${c.s >= 0 && !c.emp ? ` · <span class="bad">unemployed ${c.um} mo</span>` : ''} · ${esc(CITIES[c.city])} · ${['Primary', 'Secondary', 'University', 'Postgrad'][c.e]} · ${c.inc.toFixed(0)}K℗/yr</div><div class="tiny">Worried about <b>${esc(c.worry)}</b> · leans ${esc(PARTIES[c.p].short)}</div></div><div style="text-align:right"><div class="mono ${c.h > 60 ? 'good' : c.h < 40 ? 'bad' : ''}">${c.h.toFixed(0)}</div><div class="tiny muted">happy</div></div></div>`;
  return h;
}

// ------------------------------------------------------------------ DIPLOMACY
function diplomacy(S) {
  let h = '';
  if (S.proposals.length) {
    h += `<h3>Incoming proposals</h3>`;
    S.proposals.forEach((p, i) => { const C = S.countries[p.from]; h += `<div class="card row">${flagImg(C)}<div class="grow"><div class="name small">${p.type === 'demand' ? `Ultimatum from ${esc(C.short)}` : `${esc(C.short)} proposes a ${dip.TREATY_NAMES[p.type].toLowerCase()}`}</div><div class="tiny muted">${p.type === 'demand' ? `${esc(C.leader.name)} demands ${fmtMoney(p.amount)} in "border compensation".` : esc(C.leader.name)} · expires ${fmtDate(p.expires)}</div></div>${btn('proposal', p.type === 'demand' ? 'Pay' : 'Accept', { a: i, b: 1, cls: 'sm primary', dis: !governing(S) })}${btn('proposal', 'Reject', { a: i, b: 0, cls: 'sm', dis: !governing(S) })}</div>`; });
  }
  const sel = ui.country;
  h += `<h3>Nations</h3>`;
  for (const C of S.countries.slice(1)) {
    const r = S.rel[0][C.idx];
    h += `<div class="list-item" style="cursor:pointer;${sel === C.idx ? 'background:rgba(217,180,90,.07);' : ''}" data-act="selCountry" data-a="${C.idx}">${flagImg(C)}<div class="grow"><div class="name small">${esc(C.name)}</div><div class="tiny muted">${esc(C.leader.name)} · ${esc(C.gov)}</div></div><div style="width:110px"><div class="row tiny"><span class="grow ${r > 20 ? 'good' : r < -20 ? 'bad' : ''}">${esc(dip.relLabel(r))}</span><span class="mono">${r.toFixed(0)}</span></div><div class="bar"><i style="width:${(r + 100) / 2}%;background:${r > 20 ? 'var(--good)' : r < -20 ? 'var(--bad)' : 'var(--warn)'}"></i></div></div></div>`;
  }
  const C = S.countries[sel];
  if (C) {
    const r = S.rel[0][sel], e = C.econ;
    const trs = ['trade', 'alliance', 'nonaggression'].filter((t) => dip.hasTreaty(S, t, 0, sel));
    const war = dip.warBetween(S, 0, sel), disp = S.disputes.find((d) => !d.resolved && ((d.a === 0 && d.b === sel) || (d.b === 0 && d.a === sel)));
    h += `<h3>${esc(C.short)} — dossier</h3><div class="card"><div class="row">${flagImg(C)}<div class="grow"><div class="name">${esc(C.name)}</div><div class="tiny muted">Capital ${esc(C.capital)} · ${esc(C.species)} · ${esc(C.gov)}${C.nextElection ? ` · next election ${fmtDate(C.nextElection)}` : ''}</div></div></div>
      <div class="grid3" style="margin-top:8px"><div><div class="tiny muted">Leader</div><div class="small">${esc(C.leader.name)}</div></div><div><div class="tiny muted">Aggression</div><div class="small">${(C.leader.aggression * 100).toFixed(0)}%</div></div><div><div class="tiny muted">Trade focus</div><div class="small">${(C.leader.trade * 100).toFixed(0)}%</div></div>
      <div><div class="tiny muted">GDP</div><div class="small mono">${fmtMoney(e.gdp)}</div></div><div><div class="tiny muted">Growth</div><div class="small mono">${pct(e.growth)}</div></div><div><div class="tiny muted">Military power</div><div class="small mono">${mil.milPower(C).toFixed(0)}</div></div></div>
      <div class="row wrap" style="margin-top:8px;gap:4px">${trs.map((t) => `<span class="tag good">${dip.TREATY_NAMES[t]}</span>`).join('')}${dip.isSanctioning(S, 0, sel) ? '<span class="tag bad">You sanction them</span>' : ''}${dip.isSanctioning(S, sel, 0) ? '<span class="tag bad">They sanction you</span>' : ''}${S.embassy[0][sel] ? '<span class="tag">Embassy open</span>' : '<span class="tag bad">No embassy</span>'}${war ? '<span class="tag bad">AT WAR</span>' : ''}${dip.allies(S, sel).map((a) => `<span class="tag">Allied with ${esc(S.countries[a].short)}</span>`).join('')}</div>
      ${disp ? `<div class="callout bad" style="margin-top:8px">Disputed territory: <b>${esc(disp.name)}</b> — tension ${disp.tension.toFixed(0)}/100</div>` : ''}</div>`;
    if (!governing(S)) return h + notYet;
    const A = dip.DIPLO_ACTIONS;
    const acts = war ? ['ceasefire'] : ['envoy', 'summit', 'aid', ...['trade', 'nonaggression', 'alliance'].filter((t) => !dip.hasTreaty(S, t, 0, sel)), dip.isSanctioning(S, 0, sel) ? 'lift' : 'sanction', 'denounce', 'embassy', ...(disp ? ['negotiate'] : [])];
    h += `<div class="btns">`;
    for (const a of acts) { const chanceTxt = ['trade', 'alliance', 'nonaggression'].includes(a) ? ` · ${Math.round(dip.acceptChance(S, a, 0, sel) * 100)}%` : ''; h += btn('diplo', `${a === 'embassy' ? (S.embassy[0][sel] ? 'Close embassy' : 'Open embassy') : A[a].name}${chanceTxt} <span class="dim">(${A[a].pc})</span>`, { a, b: sel, cls: 'sm', title: A[a].desc }); }
    for (const t of trs) h += btn('cancelTreaty', `Cancel ${dip.TREATY_NAMES[t].toLowerCase()}`, { a: t, b: sel, cls: 'sm danger' });
    h += `</div><p class="note">Numbers in brackets are political-capital costs. Percentages show the chance the other leader accepts — improved by relations, an embassy and a strong Foreign Minister.</p>`;
  }
  h += `<h3>Territorial disputes</h3>`;
  for (const d of S.disputes) h += `<div class="list-item small"><div class="grow"><b>${esc(d.name)}</b> <span class="muted">${esc(S.countries[d.a].short)} vs ${esc(S.countries[d.b].short)}</span>${d.resolved ? `<div class="tiny good">Resolved${d.holder != null ? ` — held by ${esc(S.countries[d.holder].short)}` : ''}</div>` : ''}</div>${d.resolved ? '' : `<div style="width:120px"><div class="bar"><i style="width:${d.tension}%;background:${d.tension > 70 ? 'var(--bad)' : 'var(--warn)'}"></i></div><div class="tiny muted mono" style="text-align:right">tension ${d.tension.toFixed(0)}</div></div>`}</div>`;
  h += `<h3>World treaties</h3><div class="small">${S.treaties.map((t) => `${esc(S.countries[t.a].short)}–${esc(S.countries[t.b].short)}: ${dip.TREATY_NAMES[t.type].toLowerCase()}`).join('<br>')}</div>`;
  if (S.wars.length) h += `<h3>Wars</h3>${S.wars.map((w) => `<div class="small">${esc(S.countries[w.a].short)} vs ${esc(S.countries[w.b].short)} since ${fmtDate(w.since)} — score ${w.score.toFixed(0)}</div>`).join('')}`;
  return h;
}

// ------------------------------------------------------------------ MILITARY
function military(S) {
  const c = S.countries[0], m = c.mil, f = mil.forceSummary(c);
  let h = `<div class="grid3"><div class="stat"><div class="k">Personnel</div><div class="v">${(f.personnel).toFixed(0)}K</div></div><div class="stat"><div class="k">Ground divisions</div><div class="v">${f.divisions}</div></div><div class="stat"><div class="k">Combat aircraft</div><div class="v">${f.aircraft}</div></div>
    <div class="stat"><div class="k">Warships</div><div class="v">${f.ships}</div></div><div class="stat"><div class="k">Readiness</div><div class="v ${m.readiness > 70 ? 'good' : m.readiness < 45 ? 'bad' : ''}">${m.readiness.toFixed(0)}</div></div><div class="stat"><div class="k">Border security</div><div class="v">${m.border.toFixed(0)}</div></div></div>
    <div class="note" style="margin-top:6px">Defense budget ${pct(c.budget.defense)} of GDP = ${fmtMoney(f.spend)}/yr (change it in Economy → Budget). ${m.mobilized ? '<b class="bad">Mobilised.</b>' : ''} ${m.deployed ? '<b class="warn">Troops deployed to border.</b>' : ''}</div>`;
  h += `<h3>Military power ranking</h3>${barList(S.countries.map((x) => ({ label: x.short, value: mil.milPower(x), color: x.isPlayer ? '#d9b45a' : '#4c8dd6' })).sort((a, b) => b.value - a.value), { fmt: (v) => v.toFixed(0) })}`;
  const wars = dip.atWar(S, 0);
  if (wars.length) { h += `<h3>Active wars</h3>`; for (const w of wars) { const o = S.countries[w.a === 0 ? w.b : w.a], me = w.a === 0 ? w.score : -w.score; h += `<div class="card"><div class="row">${flagImg(o)}<div class="grow"><div class="name">War with ${esc(o.short)}</div><div class="tiny muted">Since ${fmtDate(w.since)} · casualties ${Math.round(w.casualties).toLocaleString()} · war weariness ${w.weariness.toFixed(0)}%</div></div></div><div class="row tiny" style="margin-top:8px"><span class="bad">Defeat −100</span><div class="bar grow"><i style="width:${(me + 100) / (100 + mil.WIN_SCORE) * 100}%;background:${me >= 0 ? 'var(--good)' : 'var(--bad)'}"></i></div><span class="good">Victory +${mil.WIN_SCORE}</span></div>
      <div class="tiny muted" style="margin:6px 0">Front line <b class="mono">${me.toFixed(0)}</b> · strength ours <b class="mono">${dip.sidePower(S, w, dip.warSide(w, 0)).toFixed(0)}</b> vs theirs <b class="mono">${dip.sidePower(S, w, dip.warSide(w, o.idx)).toFixed(0)}</b>${(w.a === 0 ? w.alliesA : w.alliesB)?.length ? ` · allies fighting: ${(w.a === 0 ? w.alliesA : w.alliesB).map((k) => esc(S.countries[k].short)).join(', ')}` : ''}</div>
      ${governing(S) ? `<div class="btns">${Object.entries(mil.WAR_ORDERS).map(([id, O]) => { const cd = (w.cd?.[id] || 0) - S.day; return btn('warOrder', `${O.name} (${O.pc})${cd > 0 ? ` · ${cd}d` : ''}`, { a: id, b: o.idx, cls: 'sm' + (id === 'offensive' ? ' primary' : ''), dis: cd > 0, title: O.desc }); }).join('')}${btn('diplo', 'Propose ceasefire (6)', { a: 'ceasefire', b: o.idx, cls: 'sm' })}</div>
      <p class="note" style="margin-bottom:0">Push the front to +${mil.WIN_SCORE} to win. Offensives and air strikes move the line; allies add their strength; the enemy may surrender once you are ahead.</p>` : ''}</div>`; } }
  if (!governing(S)) return h + notYet;
  h += `<h3>Readiness & force structure</h3>${slider('readiness', 'Readiness target', m.readinessTarget ?? 55, 30, 95, 5, '')}<div class="note">Readiness above 60 costs extra spending every month.</div>
    ${slider('alloc.ground', 'Ground forces', Math.round(m.alloc.ground * 100), 5, 80, 1, '%')}${slider('alloc.air', 'Air force', Math.round(m.alloc.air * 100), 5, 80, 1, '%')}${slider('alloc.navy', 'Navy', Math.round(m.alloc.navy * 100), 5, 80, 1, '%')}<div class="btns">${btn('applyAlloc', 'Apply force allocation', { cls: 'sm' })}</div>`;
  h += `<h3>Operations</h3><div class="row wrap" style="gap:6px"><select data-bind="exNear"><option value="">National exercises</option>${S.countries.slice(1).map((x) => `<option value="${x.idx}">Near ${esc(x.short)}</option>`).join('')}</select>${btn('exercise', 'Hold exercises (4)')}</div>
    <div class="btns" style="margin-top:6px">${btn('deploy', m.deployed ? 'Withdraw border troops' : 'Deploy troops to border')}${btn('mobilize', m.mobilized ? 'Demobilise' : 'General mobilisation', { cls: m.mobilized ? '' : 'danger' })}</div>
    <div class="row wrap" style="margin-top:6px;gap:6px"><select data-bind="warTarget">${S.countries.slice(1).filter((x) => !dip.warBetween(S, 0, x.idx)).map((x) => `<option value="${x.idx}">${esc(x.short)}</option>`).join('')}</select>${btn('declareWar', 'Declare war (25)', { cls: 'danger' })}</div>`;
  h += `<h3>Research & procurement</h3>`;
  if (m.research) { const R = RESEARCH.find((r) => r.id === m.research.id); h += `<div class="card"><div class="name small">${esc(R.name)}</div><div class="bar" style="margin-top:6px"><i style="width:${m.research.progress * 100}%"></i></div><div class="tiny muted">${(m.research.progress * 100).toFixed(0)}% complete</div></div>`; }
  for (const R of RESEARCH) { const done = m.done.includes(R.id); h += `<div class="list-item"><div class="grow"><div class="name small">${esc(R.name)} ${done ? '<span class="tag good">Complete</span>' : ''}</div><div class="tiny muted">${esc(R.desc)} ${fmtMoney(R.cost)} · ${R.months} months</div></div>${done ? '' : btn('research', 'Fund', { a: R.id, cls: 'sm', dis: !!m.research })}</div>`; }
  return h;
}

// ------------------------------------------------------------------ NEWS
function newsPanel(S) {
  const cats = ['All', ...new Set(S.news.map((n) => n.cat))];
  let h = `<div class="row" style="margin-bottom:8px"><div class="grow note">Headlines are generated from events in the simulation by five outlets with different editorial slants.</div>${governing(S) ? btn('press', `${ICONS.mic} Press room`, { cls: 'sm', dis: S.pol.pressCooldown > S.day }) : ''}</div>`;
  h += `<div class="chip-row">${cats.map((c) => `<button class="chip ${ui.newsCat === c ? 'on' : ''}" data-act="newsCat" data-a="${esc(c)}">${esc(c)}</button>`).join('')}</div>`;
  const list = S.news.filter((n) => ui.newsCat === 'All' || n.cat === ui.newsCat).slice(0, 80);
  for (const n of list) h += `<div class="news-item ${ui.openNews === n.id ? 'open' : ''}" data-act="openNews" data-a="${esc(n.id)}"><div class="meta">${esc(outletName(n.outlet).toUpperCase())} · ${esc(n.cat)} · ${fmtDate(n.day)}</div><div class="h">${esc(n.headline)}</div><div class="body">${esc(n.body)}</div></div>`;
  if (!list.length) h += `<p class="note">No stories yet.</p>`;
  return h;
}

// ------------------------------------------------------------------ INBOX
function inbox(S) {
  let h = '';
  const desk = S.pol.bills.filter((b) => b.stage === 'desk');
  const n = S.pending.length + S.proposals.length + desk.length;
  if (!n) h += `<div class="callout">Your desk is clear. Nothing requires an immediate decision.</div>`;
  if (S.pending.length) h += `<div class="card row"><div class="grow">${S.pending.length} decision(s) awaiting you</div>${btn('openPending', 'Review', { cls: 'primary sm' })}</div>`;
  for (const b of desk) h += `<div class="card row"><div class="grow small">Bill to sign: <b>${esc(pol.lawDef(b.law).name)}</b></div>${btn('goto', 'Open', { a: 'laws', cls: 'sm' })}</div>`;
  for (const p of S.proposals) h += `<div class="card row">${flagImg(S.countries[p.from])}<div class="grow small">${p.type === 'demand' ? 'Ultimatum' : 'Proposal'} from <b>${esc(S.countries[p.from].short)}</b></div>${btn('goto', 'Open', { a: 'diplomacy', cls: 'sm' })}</div>`;
  if (S.briefing && governing(S)) {
    h += `<h3>Monthly briefing — ${fmtDate(S.briefing.day)}</h3>`;
    for (const it of S.briefing.items) { const id = S.pol.cabinet[it.from]; const ch = id ? S.chars[id] : null; const P = POSITIONS.find((p) => p.id === it.from); h += `<div class="list-item">${ch ? img(ch, 'sm') : ''}<div class="grow"><div class="tiny muted">${esc(ch ? ch.name : 'Civil service')} · ${esc(P ? P.name : '')}</div><div class="small">${esc(it.text)}</div></div></div>`; }
  }
  h += `<h3>Latest reports</h3>`;
  for (const nn of S.news.filter((x) => x.imp >= 2).slice(0, 8)) h += `<div class="list-item small"><div class="grow">${esc(nn.headline)}<div class="tiny muted">${fmtDate(nn.day)}</div></div></div>`;
  return h;
}

export const PANELS = {
  government: { title: 'Government', sub: 'Executive Office', render: government },
  economy: { title: 'Economy', sub: 'Treasury & Finance', render: economy },
  laws: { title: 'Legislation', sub: 'Parliament & Laws', render: laws },
  politics: { title: 'Elections & Parties', sub: 'Political Affairs', render: politics },
  people: { title: 'Citizens', sub: 'National Statistics Office', render: people },
  diplomacy: { title: 'Diplomacy', sub: 'Foreign Affairs', render: diplomacy },
  military: { title: 'Military', sub: 'Defense & Security', render: military },
  news: { title: 'News', sub: 'Media Monitor', render: newsPanel },
  inbox: { title: 'Inbox', sub: 'Presidential Desk', render: inbox },
};

// Charts & canvases after the HTML is in the DOM
export function afterRender(name, el, S) {
  const hist = S.history; const labels = hist.map((h) => h.label);
  el.querySelectorAll('[data-spark]').forEach((cv) => sparkline(cv, hist.map((h) => h[cv.dataset.spark]).slice(-36), '#4c8dd6'));
  const ch = (k) => el.querySelector(`[data-chart="${k}"]`);
  if (ch('macro')) lineChart(ch('macro'), { labels, fmt: (v) => v.toFixed(1) + '%', refLine: 0, series: [{ name: 'Growth', color: '#3b82f6', values: hist.map((h) => h.growth) }, { name: 'Inflation', color: '#d97706', values: hist.map((h) => h.inflation) }, { name: 'Unemployment', color: '#8b5cf6', values: hist.map((h) => h.unemployment) }] });
  if (ch('trade')) lineChart(ch('trade'), { labels, fmt: (v) => '℗' + v.toFixed(0) + 'B', series: [{ name: 'Exports', color: '#3b82f6', values: hist.map((h) => h.exports) }, { name: 'Imports', color: '#d97706', values: hist.map((h) => h.imports) }] });
  if (ch('approval')) lineChart(ch('approval'), { labels, fmt: (v) => v.toFixed(0), refLine: 50, series: [{ name: 'Approval %', color: '#3b82f6', values: hist.map((h) => h.approval) }, { name: 'Happiness', color: '#d97706', values: hist.map((h) => h.happiness) }] });
  if (ch('polls')) lineChart(ch('polls'), { labels, fmt: (v) => v.toFixed(0) + '%', series: PARTIES.map((p) => ({ name: p.short, color: p.color, values: hist.map((h) => h.polls?.[p.id] ?? 0) })) });
  const sc = el.querySelector('[data-scatter]');
  if (sc) {
    const dpr = Math.min(2, devicePixelRatio || 1), w = sc.clientWidth, hgt = 240; sc.width = w * dpr; sc.height = hgt * dpr; const g = sc.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.strokeStyle = 'rgba(148,163,184,.18)'; g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, hgt); g.moveTo(0, hgt / 2); g.lineTo(w, hgt / 2); g.stroke();
    g.fillStyle = '#6f7c90'; g.font = '10px IBM Plex Sans'; g.fillText('← Economic left', 6, hgt / 2 - 4); g.fillText('Economic right →', w - 86, hgt / 2 - 4); g.fillText('Traditional', w / 2 + 4, 12); g.fillText('Progressive', w / 2 + 4, hgt - 6);
    for (const c of S.citizens) { g.fillStyle = PARTIES[c.p].color; g.globalAlpha = 0.55; g.fillRect((c.ec + 1) / 2 * w - 1.5, (1 - (c.so + 1) / 2) * hgt - 1.5, 3, 3); }
    g.globalAlpha = 1; const st = S.pol.stance; g.fillStyle = '#fff'; g.strokeStyle = '#0c1525'; g.lineWidth = 2; g.beginPath(); g.arc((st.econ + 1) / 2 * w, (1 - (st.social + 1) / 2) * hgt, 6, 0, 7); g.fill(); g.stroke();
  }
}

// ------------------------------------------------------------------ ACTIONS
// Each action: (S, a, b, ctx) → {ok,msg} | undefined. ctx gives access to app-level helpers.
export const ACTIONS = {
  tab: (S, a, b) => { ui.tab[a] = b; },
  segTab: (S, a) => { ui.segTab = a; },
  newsCat: (S, a) => { ui.newsCat = a; },
  openNews: (S, a) => { ui.openNews = ui.openNews === a ? null : a; },
  selCountry: (S, a, b, ctx) => { ui.country = +a; ctx.focusCountry?.(+a); },
  goto: (S, a, b, ctx) => ctx.openPanel(a),
  openPending: (S, a, b, ctx) => ctx.processPending(),
  appointPick: async (S, pos, b, ctx) => {
    const P = POSITIONS.find((p) => p.id === pos);
    const cands = gov.availableFor(S, pos).filter((c) => c.role !== pos).sort((x, y) => (y.party === S.player.partyId) - (x.party === S.player.partyId) || y.competence - x.competence);
    const id = await modal({ kicker: 'Appointment', title: P.name, html: `<p class="note">Specialists in <b>${P.spec.join(', ')}</b> run this department best. Opposition figures may refuse.</p>`,
      options: cands.map((c) => ({ id: c.id, label: `${c.name} — ${c.species}${c.role ? ' (currently ' + POSITIONS.find((x) => x.id === c.role).name + ')' : ''}`, hint: `${partyName(c.party)} · ${c.specialty} · competence ${c.competence}, loyalty ${Math.round(c.loyalty)}, integrity ${c.integrity} · ${c.trait}` })) });
    if (id) return gov.appoint(S, pos, id);
  },
  fire: async (S, pos) => { if (await confirmBox('Dismiss minister?', 'Firing a minister costs 5 political capital and hurts their loyalty.', 'Dismiss')) return gov.fire(S, pos); },
  order: (S, id) => gov.signOrder(S, id),
  revoke: (S, id) => { gov.revokeOrder(S, id); return { ok: true, msg: 'Order revoked.' }; },
  meeting: (S, a, b, ctx) => ctx.cabinetMeeting(),
  press: (S, a, b, ctx) => ctx.pressConference(),
  speech: (S, a, b, ctx) => ctx.speech(),
  emergency: async (S) => { const t = await modal({ kicker: 'National emergency', title: 'Declare a state of emergency', body: 'Emergency powers unlock special orders and faster spending. Declaring one without a genuine crisis damages trust.', options: Object.entries(gov.EMERGENCY_TYPES).map(([id, label]) => ({ id, label })) }); if (t) return gov.declareEmergency(S, t); },
  endEmergency: (S) => { gov.endEmergency(S); return { ok: true, msg: 'Emergency lifted.' }; },
  resetDraft: () => { ui.draft = null; },
  submitBudget: (S) => { const r = pol.proposeBudget(S, ui.draft.budget, ui.draft.taxes); if (r.ok) ui.draft = null; return r; },
  cbToggle: async (S) => { const c = S.countries[0]; if (c.cbIndependent) { if (!(await confirmBox('Take control of interest rates?', 'Markets will lose confidence in the central bank. Repeals the Central Bank Independence Act if in force.', 'Take control'))) return; c.cbIndependent = false; S.pol.activeLaws = S.pol.activeLaws.filter((x) => x !== 'cbind'); c.credibility = Math.max(0, c.credibility - 0.2); c.econ.rateTarget = c.econ.rate; return { ok: true, msg: 'You now set interest rates.' }; } c.cbIndependent = true; return { ok: true, msg: 'Central bank independence restored.' }; },
  propose: (S, id) => pol.proposeBill(S, id, false, ui.lobby ? 1 : 0),
  repeal: (S, id) => pol.proposeBill(S, id, true, ui.lobby ? 1 : 0),
  signBill: (S, id, x, ctx) => { const b = S.pol.bills.find((x) => x.law === id && x.stage === 'desk'); if (b) { pol.signBill(S, b); ctx.sting?.('law'); return { ok: true, msg: 'Signed into law.' }; } },
  vetoBill: (S, id) => { const b = S.pol.bills.find((x) => x.law === id && x.stage === 'desk'); if (b) return pol.vetoBill(S, b); },
  invite: (S, id) => pol.inviteToCoalition(S, id),
  leaveCoalition: async (S, id) => { if (await confirmBox('Remove coalition partner?', 'Their ministers will leave the cabinet.', 'Remove')) return pol.leaveCoalition(S, id); },
  campaign: (S, act, b, ctx) => pol.campaignAction(S, act, act === 'rally' ? ctx.val('rallyCity') : act === 'pledge' ? ctx.val('pledge') : null),
  proposal: (S, i, acc) => { dip.respondProposal(S, +i, acc === '1'); return { ok: true, msg: acc === '1' ? 'Accepted.' : 'Rejected.' }; },
  diplo: (S, act, to) => dip.diploAction(S, act, +to),
  cancelTreaty: async (S, type, to) => { if (await confirmBox('Cancel treaty?', 'Breaking an agreement badly damages relations.', 'Cancel treaty')) return dip.diploAction(S, 'cancel', +to, type); },
  applyAlloc: (S, a, b, ctx) => mil.setAlloc(S, { ground: +ctx.val('alloc.ground'), air: +ctx.val('alloc.air'), navy: +ctx.val('alloc.navy') }),
  exercise: (S, a, b, ctx) => { const v = ctx.val('exNear'); return mil.militaryExercise(S, v === '' ? null : +v); },
  deploy: (S) => mil.toggleDeploy(S),
  mobilize: async (S) => { if (!S.countries[0].mil.mobilized && !(await confirmBox('Order general mobilisation?', 'Raises military power by 25% but costs 0.8% of GDP per year and alarms neighbours.', 'Mobilise'))) return; return mil.toggleMobilize(S); },
  declareWar: async (S, a, b, ctx) => { const t = +ctx.val('warTarget'); const C = S.countries[t]; if (!C) return; if (await confirmBox(`Declare war on ${C.short}?`, 'War devastates the economy, costs lives and may bring international sanctions. This cannot be undone easily.', 'Declare war')) return mil.playerDeclareWar(S, t); },
  research: (S, id) => mil.startResearch(S, id),
  warOrder: (S, id, enemy) => mil.warOrder(S, +enemy, id),
};

// Live slider binding: update displayed value and draft state
export function onBind(S, bind, value, el) {
  const out = el.querySelector(`[data-val="${bind}"]`);
  if (bind === 'lobby') { ui.lobby = value; return true; }
  if (bind.startsWith('tax.') || bind.startsWith('bud.')) {
    const [kind, key] = bind.split('.'); const d = ui.draft; if (!d) return;
    (kind === 'tax' ? d.taxes : d.budget)[key] = +value;
    if (out) out.textContent = (+value).toFixed(kind === 'tax' ? 0 : 1) + (kind === 'tax' ? '%' : '');
    return true; // panel re-render to refresh projections
  }
  if (bind === 'rate') { S.countries[0].econ.rateTarget = +value; if (out) out.textContent = (+value).toFixed(2) + '%'; }
  if (bind === 'readiness') { mil.setReadiness(S, +value); if (out) out.textContent = value; }
  if (bind.startsWith('alloc.') && out) out.textContent = value + '%';
  return false;
}
