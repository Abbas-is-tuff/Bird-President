// Bird President — application bootstrap, game loop, HUD, menus and decision flows.
import { Engine3D } from './render/engine3d.js';
import { createOffice } from './render/office.js';
import { createCity } from './render/city.js';
import { createWorldMap } from './render/worldmap.js';
import { renderPortraits, portrait } from './render/portraits.js';
import { generateWorld } from './sim/mapgen.js';
import { newGame } from './sim/setup.js';
import { tick, primeState, SPEEDS } from './sim/engine.js';
import { eventView, resolveEvent } from './sim/events.js';
import { CORE_CHARS, PARTIES, COUNTRIES, POSITIONS } from './sim/data.js';
import { fmtDate, pct, fmtMoney, clamp } from './sim/util.js';
import * as gov from './sim/government.js';
import { partyName } from './sim/news.js';
import * as save from './sim/save.js';
import { $, esc, ICONS, SEAL_SVG, modal, closeModal, modalOpen, toast, confirmBox } from './ui/dom.js';
import { PANELS, ACTIONS, afterRender, onBind, ui, resultSummary } from './ui/panels.js';
import { music } from './audio/music.js';

// ---------- Settings ----------
const isMobile = matchMedia('(max-width: 760px)').matches || /Mobi|Android/i.test(navigator.userAgent);
const DEFAULT_SETTINGS = { quality: isMobile ? 'medium' : 'high', bloom: !isMobile, shadows: true, lockTime: false, lockHour: 16.5, autosave: true, musicOn: true, musicVol: 0.6 };
let settings = { ...DEFAULT_SETTINGS };
try { settings = { ...settings, ...JSON.parse(localStorage.getItem('birdpresident.settings') || '{}') }; } catch {}
const saveSettings = () => { try { localStorage.setItem('birdpresident.settings', JSON.stringify(settings)); } catch {} };

// ---------- App state ----------
let S = null, S0 = null, engine, office, city, worldView, world;
let speed = 0, acc = 0, lastDay = -1, panelName = null, panelDirty = true, lastInteract = 0, lastPanelRefresh = 0, viewName = 'city';
let menuOpen = true, lastMoodCheck = 0, lastWarCount = 0;

function updateMusic() {
  if (!S || menuOpen) return music.setMood('menu');
  const p = S.pol, myWars = S.wars.filter((w) => w.a === 0 || w.b === 0).length;
  if (myWars > lastWarCount) music.sting('war');
  lastWarCount = myWars;
  const crisis = myWars || p.emergency || p.protest || (p.phase === 'governing' && p.approval < 30) || S.disputes.some((d) => !d.resolved && (d.a === 0 || d.b === 0) && d.tension > 80);
  music.setMood(crisis ? 'tension' : p.campaign ? 'campaign' : 'calm');
}

async function init() {
  world = generateWorld(1337);
  world.countryColors = COUNTRIES.map((c) => c.color);
  S0 = newGame({ seed: 7 });
  primeState(S0);
  engine = new Engine3D($('#gl'), settings);
  renderPortraits(Object.values(S0.chars));
  office = createOffice(engine.renderer, S0); office.setWorld(world); office.setPresident(S0.chars.abbas);
  city = createCity(engine.renderer, S0); city.applySettings(settings);
  worldView = createWorldMap(engine.renderer, world, $('#labels'));
  engine.register('office', office); engine.register('city', city); engine.register('world', worldView);
  engine.applySettings(settings);
  setView('city');
  city.controls.autoRotate = true; city.controls.autoRotateSpeed = 0.35;
  engine.onPick = onPick;
  engine.onHover = (hit, e) => { const tip = $('#hover-tip'); if (hit && hit.label && !menuOpen) { tip.style.display = 'block'; tip.textContent = hit.label; tip.style.left = e.clientX + 14 + 'px'; tip.style.top = e.clientY + 14 + 'px'; $('#gl').style.cursor = 'pointer'; } else { tip.style.display = 'none'; $('#gl').style.cursor = ''; } };
  music.setVolume(settings.musicVol); music.setEnabled(settings.musicOn);
  const unlock = () => music.unlock();
  window.addEventListener('pointerdown', unlock, true); window.addEventListener('keydown', unlock, true);
  buildChrome();
  showMainMenu();
  $('#loading').remove();
  requestAnimationFrame(loop);
}

// ---------- Main loop ----------
let lastT = performance.now();
function loop(now) {
  const dt = Math.min(0.1, (now - lastT) / 1000); lastT = now;
  if (S && !menuOpen && S.pol.phase !== 'gameover' && !modalOpen()) {
    acc += dt * SPEEDS[speed];
    let n = 0;
    while (acc >= 1 && n < 20) {
      acc -= 1; n++; tick(S);
      if (S.day % 30 === 0 && settings.autosave) save.saveSlot(S, 'auto');
      if (S.pending.length || S.pol.phase === 'gameover') { acc = 0; break; }
    }
    if (S.pending.length || S.pol.phase === 'gameover') processPending();
  }
  if (S) drainToasts();
  if (now - lastMoodCheck > 1000) { lastMoodCheck = now; updateMusic(); }
  try { engine.frame(S || S0); } catch (err) { console.error(err); }
  if (S && S.day !== lastDay) { lastDay = S.day; updateHUD(); panelDirty = true; }
  if (panelName && panelDirty && now - lastInteract > 2500 && now - lastPanelRefresh > 1200) renderPanel();
  requestAnimationFrame(loop);
}

function drainToasts() { while (S.toasts.length) { const t = S.toasts.shift(); toast(t.text, t.cat, t.tone); } }

// ---------- Chrome: top bar, dock, panel ----------
const DOCK = [['office', 'Office', 'view'], ['city', 'Capital', 'view'], ['world', 'World', 'view'], ['sep'], ['government', 'Govt'], ['economy', 'Economy'], ['laws', 'Laws'], ['politics', 'Politics'], ['people', 'Citizens'], ['diplomacy', 'Diplomacy'], ['military', 'Military'], ['news', 'News'], ['inbox', 'Inbox'], ['sep'], ['menu', 'Menu', 'sys']];
function buildChrome() {
  $('#brand').innerHTML = `${SEAL_SVG}<span>BIRD PRESIDENT</span>`;
  const sp = [['pause', 0], ['play', 1], ['ff', 2], ['fff', 3], ['ffff', 4]];
  $('#clock').innerHTML = `<span class="date" id="date"></span>${sp.map(([ic, v]) => `<button class="spd" data-speed="${v}" aria-label="Speed ${v}">${ICONS[ic]}</button>`).join('')}`;
  $('#clock').onclick = (e) => { const b = e.target.closest('[data-speed]'); if (b) setSpeed(+b.dataset.speed); };
  const mb = document.createElement('button'); mb.className = 'icon-btn'; mb.id = 'music-btn'; mb.setAttribute('aria-label', 'Toggle music');
  const paintMusic = () => { mb.innerHTML = settings.musicOn ? ICONS.music : ICONS.musicOff; mb.title = settings.musicOn ? 'Music on' : 'Music off'; };
  mb.onclick = () => { settings.musicOn = !settings.musicOn; saveSettings(); music.unlock(); music.setEnabled(settings.musicOn); paintMusic(); toast(settings.musicOn ? 'Music on' : 'Music off'); };
  mb.addEventListener('repaint', paintMusic); paintMusic(); $('#topbar').appendChild(mb);
  $('#dock').innerHTML = DOCK.map(([id, label, kind]) => (id === 'sep' ? '<div class="dock-sep"></div>' : `<button class="dock-btn" data-dock="${id}" data-kind="${kind || 'panel'}">${ICONS[id] || ICONS.menu}<span>${label}</span></button>`)).join('');
  $('#dock').onclick = (e) => { const b = e.target.closest('[data-dock]'); if (!b) return; const id = b.dataset.dock; if (b.dataset.kind === 'view') { setView(id); closePanel(); } else if (id === 'menu') showSystemMenu(); else togglePanel(id); };
  $('#panel-close').innerHTML = ICONS.close; $('#panel-close').onclick = closePanel;
  $('#kpis').onclick = (e) => { const k = e.target.closest('[data-panel]'); if (k) openPanel(k.dataset.panel); };
  const body = $('#panel-body');
  body.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
    lastInteract = 0;
    const fn = ACTIONS[b.dataset.act]; if (!fn) return;
    const r = await fn(S, b.dataset.a, b.dataset.b, ctx);
    if (r && r.msg) toast(r.msg, '', r.ok ? 1 : -1);
    updateHUD(); renderPanel(true);
  });
  body.addEventListener('input', (e) => { const el = e.target.closest('[data-bind]'); if (!el) return; lastInteract = performance.now(); const v = el.type === 'checkbox' ? el.checked : el.value; const rerender = onBind(S, el.dataset.bind, v, body); if (rerender) { panelDirty = true; scheduleRerender(); } });
  body.addEventListener('pointerdown', () => { lastInteract = performance.now(); });
  body.addEventListener('scroll', () => { lastInteract = performance.now(); }, { passive: true });
  window.addEventListener('keydown', (e) => { if (!S || menuOpen || e.target.matches('input,textarea,select')) return; if (e.code === 'Space') { e.preventDefault(); setSpeed(speed ? 0 : 1); } if (/^Digit[0-4]$/.test(e.code)) setSpeed(+e.code.slice(5)); if (e.code === 'Escape') closePanel(); });
}
let rerenderT = null;
function scheduleRerender() { clearTimeout(rerenderT); rerenderT = setTimeout(() => renderPanel(true), 140); }

const ctx = {
  openPanel: (n) => openPanel(n), processPending: () => processPending(true), focusCountry: (i) => { if (viewName === 'world') worldView.focus(i); },
  val: (bind) => { const el = $('#panel-body').querySelector(`[data-bind="${bind}"]`); return el ? el.value : ''; },
  sting: (k) => music.sting(k), cabinetMeeting: () => cabinetMeeting(), pressConference: () => pressConference(), speech: () => speech(),
};

function setSpeed(v) { if (!S) return; speed = v; document.querySelectorAll('.spd').forEach((b) => b.classList.toggle('on', +b.dataset.speed === v)); }
function setView(name) {
  viewName = name; engine.show(name);
  if (name !== 'city') city.controls.autoRotate = false;
  document.querySelectorAll('[data-kind="view"]').forEach((b) => b.classList.toggle('on', b.dataset.dock === name));
  const vb = $('#viewbar');
  if (menuOpen) { vb.classList.add('hidden'); return; }
  vb.classList.remove('hidden');
  if (name === 'world') vb.innerHTML = [['political', 'Political'], ['relations', 'Relations'], ['alliances', 'Alliances'], ['economy', 'Growth'], ['military', 'Military'], ['terrain', 'Terrain']].map(([m, l]) => `<button class="chip ${worldView.mode === m ? 'on' : ''}" data-mode="${m}">${l}</button>`).join('');
  else if (name === 'office') vb.innerHTML = [['overview', 'Overview'], ['desk', 'At the desk'], ['meeting', 'Meeting area'], ['tv', 'Television'], ['lectern', 'Lectern']].map(([m, l]) => `<button class="chip" data-cam="${m}">${l}</button>`).join('');
  else vb.innerHTML = `<button class="chip" data-cityrot>${city.controls.autoRotate ? 'Stop tour' : 'Aerial tour'}</button><button class="chip" data-palace>Palace</button>`;
  vb.onclick = (e) => {
    const m = e.target.closest('[data-mode]'); if (m) { worldView.setMode(m.dataset.mode); setView('world'); }
    const c = e.target.closest('[data-cam]'); if (c) office.goTo(c.dataset.cam);
    if (e.target.closest('[data-cityrot]')) { city.controls.autoRotate = !city.controls.autoRotate; setView('city'); }
    if (e.target.closest('[data-palace]')) { city.controls.target.set(0, 8, 0); city.camera.position.set(40, 30, 90); }
  };
}
function togglePanel(n) { if (panelName === n) closePanel(); else openPanel(n); }
function openPanel(n) {
  if (!PANELS[n]) return;
  panelName = n; $('#panel').classList.remove('hidden');
  document.querySelectorAll('[data-kind="panel"]').forEach((b) => b.classList.toggle('on', b.dataset.dock === n));
  if (n === 'diplomacy' && viewName !== 'world' && !isMobile) setView('world');
  renderPanel(true, true);
}
function closePanel() { panelName = null; $('#panel').classList.add('hidden'); document.querySelectorAll('[data-kind="panel"]').forEach((b) => b.classList.remove('on')); }
function renderPanel(force = false, resetScroll = false) {
  if (!panelName || !S) return;
  const P = PANELS[panelName], body = $('#panel-body');
  const st = resetScroll ? 0 : body.scrollTop;
  $('#panel-title').textContent = P.title; $('#panel-sub').textContent = P.sub;
  body.innerHTML = P.render(S);
  afterRender(panelName, body, S);
  body.scrollTop = st;
  panelDirty = false; lastPanelRefresh = performance.now();
}

function updateHUD() {
  if (!S) return;
  const e = S.countries[0].econ, p = S.pol;
  $('#date').textContent = fmtDate(S.day);
  const ph = p.phase === 'candidate' ? `Candidate · election in ${p.nextPresElection - S.day}d` : p.campaign ? `${p.campaign.kind === 'presidential' ? 'Re-election' : 'Parliament'} campaign · ${p.campaign.daysLeft}d` : p.phase === 'gameover' ? 'Out of office' : `Term ${p.terms} · ${S.countries[0].short}`;
  $('#phase').textContent = ph;
  const k = (label, v, cls, panel) => `<div class="kpi" data-panel="${panel}"><div class="k">${label}</div><div class="v ${cls}">${v}</div></div>`;
  $('#kpis').innerHTML = [
    k('Approval', p.phase === 'candidate' ? `${pct(S.parties[S.player.partyId].poll, 0)}*` : pct(p.approval, 0), p.approval >= 50 ? 'good' : p.approval < 35 ? 'bad' : '', 'politics'),
    k('Growth', pct(e.growth), e.growth > 1 ? 'good' : e.growth < 0 ? 'bad' : '', 'economy'),
    k('Inflation', pct(e.inflation), e.inflation > 4.5 ? 'bad' : '', 'economy'),
    k('Jobless', pct(e.unemployment), e.unemployment > 8 ? 'bad' : '', 'economy'),
    k('Debt', pct(e.debt / e.gdp * 100, 0), e.debt / e.gdp > 1 ? 'bad' : '', 'economy'),
    k('Capital', p.capital.toFixed(0), p.capital < 15 ? 'bad' : '', 'government'),
    k('Happiness', (S.kpis.happiness || 0).toFixed(0), '', 'people'),
  ].join('');
  const inbox = S.pending.length + S.proposals.length + p.bills.filter((b) => b.stage === 'desk').length;
  const ib = document.querySelector('[data-dock="inbox"]'); ib.querySelector('.badge')?.remove();
  if (inbox) ib.insertAdjacentHTML('beforeend', `<span class="badge">${inbox}</span>`);
}

// ---------- 3D picks ----------
async function onPick(hit) {
  if (menuOpen || !S) return;
  const a = hit.action;
  if (a === 'computer' || a === 'president') openPanel('government');
  else if (a === 'inbox') openPanel('inbox');
  else if (a === 'news') { office.goTo('tv'); openPanel('news'); }
  else if (a === 'diplomacy') openPanel('diplomacy');
  else if (a === 'cabinet') cabinetMeeting();
  else if (a === 'press') { if (!gov.isGoverning(S)) return toast('Only the President uses the lectern.', '', -1); const r = await modal({ kicker: 'Lectern', title: 'Address the press or the nation?', options: [{ id: 'press', label: 'Hold a press conference', hint: S.pol.pressCooldown > S.day ? `Available in ${S.pol.pressCooldown - S.day} days` : 'Answer three questions from journalists' }, { id: 'speech', label: 'Give a televised speech', hint: 'Choose topic and tone' }] }); if (r === 'press') pressConference(); if (r === 'speech') speech(); }
  else if (a === 'world') setView('world');
  else if (a === 'office') setView('office');
  else if (a.startsWith('minister:')) { const ch = S.chars[a.slice(9)]; modal({ kicker: POSITIONS.find((p) => p.id === ch.role)?.name || 'Official', title: ch.name, html: `<div class="row" style="align-items:flex-start"><img class="portrait lg" src="${portrait(ch)}"><div class="grow small">${esc(ch.species)} · ${esc(partyName(ch.party))}<br>${esc(ch.bio || ch.trait)}<br><br>Competence <b>${ch.competence}</b> · Charisma <b>${ch.charisma}</b> · Integrity <b>${ch.integrity}</b> · Loyalty <b>${Math.round(ch.loyalty)}</b></div></div>` }); }
  else if (a.startsWith('country:')) { const i = +a.slice(8); if (i === 0) { openPanel('economy'); return; } ui.country = i; openPanel('diplomacy'); }
}

// ---------- Decisions: events, elections, game over ----------
let processing = false;
async function processPending(force) {
  if (processing || modalOpen()) return;
  processing = true;
  const wasSpeed = speed; setSpeed(0);
  try {
    while (S.pending.length) {
      const p = S.pending[0];
      if (p.type === 'event') {
        const v = eventView(S, p);
        music.sting('event');
        const opt = await modal({ kicker: 'Decision required · ' + fmtDate(S.day), title: v.title, body: v.body, options: v.options, dismiss: false });
        resolveEvent(S, p, opt);
        drainToasts();
      } else if (p.type === 'electionResult') {
        S.pending.shift();
        await electionModal();
      } else if (p.type === 'gameover') { S.pending.shift(); }
      else S.pending.shift();
      updateHUD();
    }
    if (S.pol.phase === 'gameover') await gameOver();
  } finally { processing = false; if (S && S.pol.phase !== 'gameover') setSpeed(force ? wasSpeed : wasSpeed); renderPanel(true); }
}

async function electionModal() {
  const r = S.pol.lastResult; if (!r) return;
  const won = r.kind === 'presidential' ? r.won : true;
  const rows = r.kind === 'presidential' ? Object.entries((r.runoff || r.round1).share).sort((a, b) => b[1] - a[1]).map(([pid, v]) => ({ name: `${S.chars[S.parties[pid].leader]?.name} — ${partyName(pid)}`, v, c: PARTIES.find((p) => p.id === pid).color, pid }))
    : PARTIES.map((p) => ({ name: p.name, v: r.share[p.id], c: p.color, seats: r.seats[p.id], pid: p.id })).sort((a, b) => b.v - a.v);
  const html = `${rows.map((x) => `<div style="margin:9px 0"><div class="row small"><span class="grow">${esc(x.name)}</span><span class="mono">${pct(x.v)}${x.seats != null ? ` · ${x.seats} seats` : ''}</span></div><div class="bar" style="height:10px"><i style="width:${x.v}%;background:${x.c}"></i></div></div>`).join('')}<p class="note">${resultSummary(S, r)}</p>`;
  const first = r.kind === 'presidential' && won && S.pol.terms === 1;
  music.sting(won ? 'win' : 'lose');
  await modal({ kicker: r.kind === 'presidential' ? 'Presidential election' : 'Parliamentary election', title: r.kind === 'presidential' ? (won ? `${gov.president(S).name} wins the presidency` : 'Defeat at the polls') : 'Parliament elected', html, dismiss: false, options: [{ id: 'ok', label: first ? 'Take the oath of office' : 'Continue' }] });
  if (first) {
    setView('office'); office.setPresident(gov.president(S));
    const r2 = await modal({ kicker: 'Inauguration', title: `President ${gov.president(S).name}`, html: `<p>You have been sworn in as President of ${esc(S.countries[0].name)}. Your party leadership has proposed a cabinet; review it, and choose your Vice President.</p><p class="note">Your coalition holds ${S.pol.coalition.reduce((s, id) => s + S.parties[id].seats, 0)} of 200 seats. Below 101 you will need partners to pass laws — invite parties in Politics.</p>`, dismiss: false, options: [{ id: 'vp', label: 'Choose a Vice President', hint: `Currently: ${gov.charName(S, S.pol.cabinet.vp)}` }, { id: 'cab', label: 'Review the cabinet' }, { id: 'go', label: 'Get to work' }] });
    if (r2 === 'vp') { const res = await ACTIONS.appointPick(S, 'vp'); if (res?.msg) toast(res.msg, '', res.ok ? 1 : -1); openPanel('government'); }
    if (r2 === 'cab') openPanel('government');
    setSpeed(1);
  }
}

async function gameOver() {
  setSpeed(0);
  const p = S.pol;
  const r = await modal({ kicker: 'End of presidency', title: 'Your time in office is over', html: `<p>${esc(p.gameOverReason || 'You are no longer President.')}</p><div class="grid3"><div class="stat"><div class="k">Days</div><div class="v">${S.day}</div></div><div class="stat"><div class="k">Terms won</div><div class="v">${p.terms}</div></div><div class="stat"><div class="k">Final approval</div><div class="v">${pct(p.approval, 0)}</div></div></div><p class="note">Laws passed: ${p.activeLaws.length}. GDP ${fmtMoney(S.countries[0].econ.gdp)}. Debt ${pct(S.countries[0].econ.debt / S.countries[0].econ.gdp * 100, 0)} of GDP.</p>`, dismiss: false, options: [{ id: 'new', label: 'Start a new campaign' }, { id: 'load', label: 'Load a saved game' }, { id: 'menu', label: 'Main menu' }] });
  if (r === 'new') showNewGame(); else if (r === 'load') showSaveLoad(true); else showMainMenu();
}

// ---------- Presidential flows ----------
async function pressConference() {
  if (!gov.isGoverning(S)) return;
  if (S.pol.pressCooldown > S.day) return toast(`Next press conference in ${S.pol.pressCooldown - S.day} days.`, '', -1);
  setSpeed(0); setView('office'); office.goTo('lectern');
  const qs = gov.buildPressConference(S), results = [];
  for (let i = 0; i < qs.length; i++) {
    const q = qs[i];
    const opt = await modal({ kicker: `Press conference · question ${i + 1} of ${qs.length}`, title: `“${q.q}”`, options: q.options.map((o) => ({ id: o.id, label: o.label })), dismiss: false });
    const r = gov.answerPress(S, q, opt); results.push(r);
    toast(r.d > 0 ? 'That answer landed well.' : 'That answer did not go down well.', 'Press', r.d > 0 ? 1 : -1);
  }
  gov.finishPress(S, results); drainToasts(); updateHUD();
}
async function speech() {
  if (!gov.isGoverning(S)) return;
  if (S.pol.speechCooldown > S.day) return toast('You addressed the nation recently.', '', -1);
  setSpeed(0);
  const topic = await modal({ kicker: 'Address to the nation', title: 'What will you speak about?', options: Object.entries(gov.SPEECH_TOPICS).map(([id, label]) => ({ id, label })) });
  if (!topic) return;
  const tone = await modal({ kicker: 'Address to the nation', title: 'Choose your tone', options: [{ id: 'inspiring', label: 'Inspiring', hint: 'Relies on your charisma' }, { id: 'sober', label: 'Sober & honest', hint: 'Best when times are hard' }, { id: 'combative', label: 'Combative', hint: 'Fires up the base, alienates the press' }] });
  if (!tone) return;
  setView('office'); office.goTo('lectern');
  const r = gov.giveSpeech(S, topic, tone);
  toast(r.msg, 'Speech', r.ok && r.d > 0 ? 1 : -1); drainToasts(); updateHUD();
}
async function cabinetMeeting() {
  if (!gov.isGoverning(S)) return toast('You will meet ministers once you are President.', '', -1);
  setSpeed(0); setView('office'); office.setMeeting(S, true);
  const items = (S.briefing?.items || []).map((it) => { const id = S.pol.cabinet[it.from]; const ch = id ? S.chars[id] : null; return `<div class="list-item">${ch ? `<img class="portrait sm" src="${portrait(ch)}">` : ''}<div class="grow"><div class="tiny muted">${esc(ch ? ch.name : 'Civil service')} · ${esc(POSITIONS.find((p) => p.id === it.from)?.name || '')}</div><div class="small">${esc(it.text)}</div></div></div>`; }).join('');
  const r = await modal({ kicker: 'Cabinet Room', title: 'Cabinet meeting', html: `<p class="note">Your ministers have gathered in the Oval Nest. Each department's efficiency depends on who leads it.</p>${items || '<p class="note">No briefings this month.</p>'}`, options: [{ id: 'gov', label: 'Review appointments & departments' }, { id: 'econ', label: 'Work on the budget with the Finance Minister' }, { id: 'end', label: 'End meeting' }], dismiss: false });
  office.setMeeting(S, false); office.goTo('overview');
  if (r === 'gov') openPanel('government'); if (r === 'econ') { ui.tab.economy = 'budget'; openPanel('economy'); }
}

// ---------- Menus ----------
function hideChrome(h) { for (const id of ['#topbar', '#dock']) $(id).classList.toggle('hidden', h); if (h) { $('#viewbar').classList.add('hidden'); closePanel(); } }
function showMenuHtml(html) { menuOpen = true; hideChrome(true); const m = $('#menu'); m.classList.remove('hidden'); m.innerHTML = `<div class="menu-inner">${html}</div>`; m.scrollTop = 0; return m; }
function hideMenu() { menuOpen = false; $('#menu').classList.add('hidden'); hideChrome(false); setView(viewName); updateHUD(); }

function showMainMenu() {
  S = null; speed = 0; setView('city'); city.controls.autoRotate = true;
  const meta = save.slotMeta('auto');
  const m = showMenuHtml(`<div class="seal">${SEAL_SVG}</div><h1 class="title">Bird<br>President</h1><div class="subtitle">A political and geopolitical simulator. Win the election, govern a nation of birds, manage its economy, and steer it through a world of rival powers.</div>
    ${meta ? `<button class="menu-btn primary" data-m="continue">Continue <small>${esc(meta.name)} · ${fmtDate(meta.day)}</small></button>` : ''}
    <button class="menu-btn ${meta ? '' : 'primary'}" data-m="new">New game <small>Run for president</small></button>
    <button class="menu-btn" data-m="load">Load game</button>
    <button class="menu-btn" data-m="settings">Settings</button>
    <button class="menu-btn" data-m="help">How to play</button>
    <p class="note" style="margin-top:18px">Progress saves in this browser. Use Export in the menu to move a save to another device.</p>`);
  m.onclick = (e) => { const b = e.target.closest('[data-m]'); if (!b) return; const a = b.dataset.m;
    if (a === 'continue') { const s = save.loadSlot('auto'); if (s) startWith(s); }
    if (a === 'new') showNewGame(); if (a === 'load') showSaveLoad(true); if (a === 'settings') showSettings(true); if (a === 'help') showHelp(); };
}

function showNewGame() {
  const choice = { birdId: 'abbas', partyId: 'unity', countryName: 'Republic of Aviania', difficulty: 'normal' };
  const render = () => {
    const m = showMenuHtml(`<button class="btn sm" data-m="back">← Back</button><h1 class="title" style="font-size:40px">New campaign</h1>
      <h3>Your candidate</h3><div class="pick-grid">${CORE_CHARS.map((c) => `<button class="pick ${choice.birdId === c.id ? 'on' : ''}" data-bird="${c.id}"><img src="${portrait(S0.chars[c.id])}" alt=""><div class="name">${esc(c.name)}</div><div class="tiny muted">${esc(c.species)} · ${esc(c.trait)}</div><div class="tiny muted">Charisma ${c.charisma} · Competence ${c.competence}</div></button>`).join('')}</div>
      <p class="note">${esc(CORE_CHARS.find((c) => c.id === choice.birdId).bio)}</p>
      <h3>Your party</h3><div class="pick-grid">${PARTIES.map((p) => `<button class="pick ${choice.partyId === p.id ? 'on' : ''}" data-party="${p.id}"><div class="row"><span style="width:12px;height:12px;border-radius:3px;background:${p.color}"></span><div class="name">${esc(p.name)}</div></div><div class="tiny muted">${esc(p.desc)}</div></button>`).join('')}</div>
      <h3>Nation</h3><input type="text" id="ng-name" value="${esc(choice.countryName)}" maxlength="34" style="width:100%">
      <h3>Difficulty</h3><div class="chip-row">${['easy', 'normal', 'hard'].map((d) => `<button class="chip ${choice.difficulty === d ? 'on' : ''}" data-diff="${d}">${d[0].toUpperCase() + d.slice(1)}</button>`).join('')}</div>
      <p class="note">${choice.birdId === 'silver' ? 'Silver usually leads the opposition; choosing Silver puts Abbas at the head of your main rival party.' : 'Silver leads the main rival party and will be your opponent.'} The first election is in 45 days. Campaign hard: rallies, ads, pledges and a televised debate.</p>
      <button class="menu-btn primary" data-m="start" style="margin-top:16px">Launch campaign</button>`);
    m.onclick = (e) => {
      const t = e.target.closest('[data-bird],[data-party],[data-diff],[data-m]'); if (!t) return;
      choice.countryName = $('#ng-name').value.trim() || 'Republic of Aviania';
      if (t.dataset.bird) choice.birdId = t.dataset.bird; if (t.dataset.party) choice.partyId = t.dataset.party; if (t.dataset.diff) choice.difficulty = t.dataset.diff;
      if (t.dataset.m === 'back') return showMainMenu();
      if (t.dataset.m === 'start') { const s = newGame(choice); primeState(s); startWith(s, true); return; }
      render();
    };
  };
  render();
}

function startWith(state, fresh = false) {
  S = state; acc = 0; lastDay = -1; ui.draft = null;
  // rebuild office for this nation (carpet seal & name) and seat the president
  office.controls.dispose();
  office = createOffice(engine.renderer, S); office.setWorld(world); office.setPresident(gov.president(S)); engine.register('office', office); engine.active = null;
  renderPortraits(Object.values(S.chars));
  hideMenu(); setView(fresh ? 'city' : 'office'); city.controls.autoRotate = false;
  setSpeed(0); updateHUD();
  if (fresh) {
    modal({ kicker: `${fmtDate(S.day, true)} · ${S.countries[0].name}`, title: `${gov.president(S).name} for President`, html: `<p>The presidential election is in <b>${S.pol.nextPresElection} days</b>. You lead the ${esc(partyName(S.player.partyId))}; your main rival is ${esc(S.chars[Object.values(S.parties).find((p) => p.leader && p.id !== S.player.partyId && (p.leader === 'silver' || p.leader === 'abbas'))?.leader]?.name || 'Silver')}.</p><p class="note">Open <b>Politics</b> to campaign (one action per day), then press play. Once elected, you'll govern from the Oval Nest: tap the computer, documents, phone, TV, door and lectern in the office.</p>`, dismiss: false, options: [{ id: 'go', label: 'Open the campaign hub' }] }).then(() => { openPanel('politics'); setSpeed(1); });
  }
  save.saveSlot(S, 'auto');
}

function showSystemMenu() {
  setSpeed(0);
  modal({ kicker: 'Menu', title: 'Bird President', options: [{ id: 'resume', label: 'Resume' }, { id: 'save', label: 'Save / load game' }, { id: 'settings', label: 'Settings' }, { id: 'help', label: 'How to play' }, { id: 'main', label: 'Quit to main menu', hint: 'Unsaved progress since the last autosave is lost' }] }).then(async (r) => {
    if (r === 'save') showSaveLoad(false); if (r === 'settings') showSettings(false); if (r === 'help') showHelp(false);
    if (r === 'main' && (await confirmBox('Quit to main menu?', 'Your game was autosaved at the start of this month.', 'Quit'))) { save.saveSlot(S, 'auto'); showMainMenu(); }
  });
}

function showSaveLoad(fromMenu) {
  const slots = save.SLOTS.map((id) => ({ id, meta: save.slotMeta(id) }));
  const html = `${save.storageAvailable() ? '' : '<div class="callout bad">This browser blocks storage, so saves last only while this tab is open. Use Export to keep a save.</div>'}
    ${slots.map(({ id, meta }) => `<div class="list-item"><div class="grow"><div class="name small">${id === 'auto' ? 'Autosave' : 'Slot ' + id.slice(4)}</div><div class="tiny muted">${meta ? `${esc(meta.name)} · ${esc(meta.country)} · ${fmtDate(meta.day)} · approval ${pct(meta.approval || 0, 0)}` : 'Empty'}</div></div>${!fromMenu && S && id !== 'auto' ? `<button class="btn sm" data-save="${id}">Save</button>` : ''}${meta ? `<button class="btn sm" data-load="${id}">Load</button><button class="btn sm danger" data-del="${id}">Delete</button>` : ''}</div>`).join('')}
    <h3>Transfer between devices</h3>${S ? '<button class="btn sm" data-export>Export current game</button> ' : ''}<button class="btn sm" data-import>Import save code</button><div id="xfer"></div>`;
  modal({ kicker: 'Saved games', title: fromMenu ? 'Load game' : 'Save or load', html, onRender: (root, done) => {
    root.addEventListener('click', async (e) => {
      const t = e.target;
      if (t.dataset.save) { const ok = save.saveSlot(S, t.dataset.save); toast(ok ? 'Game saved.' : 'Save failed (storage full?)', '', ok ? 1 : -1); done(); showSaveLoad(fromMenu); }
      if (t.dataset.load) { try { const s = save.loadSlot(t.dataset.load); done(); startWith(s); toast('Game loaded.', '', 1); } catch (err) { toast('Could not load: ' + err.message, '', -1); } }
      if (t.dataset.del) { save.deleteSlot(t.dataset.del); done(); showSaveLoad(fromMenu); }
      if (t.hasAttribute('data-export')) { const code = save.exportCode(S); root.querySelector('#xfer').innerHTML = `<p class="note">Copy this code and import it on another device (${(code.length / 1024).toFixed(0)} KB).</p><textarea rows="5" readonly>${code}</textarea><button class="btn sm" data-copy>Copy code</button>`; }
      if (t.hasAttribute('data-copy')) { try { await navigator.clipboard.writeText(root.querySelector('textarea').value); toast('Copied.', '', 1); } catch { root.querySelector('textarea').select(); toast('Select the text and copy it manually.', ''); } }
      if (t.hasAttribute('data-import')) { root.querySelector('#xfer').innerHTML = `<p class="note">Paste a save code:</p><textarea rows="5" id="imp"></textarea><button class="btn sm primary" data-doimport>Load this save</button>`; }
      if (t.hasAttribute('data-doimport')) { try { const s = save.importCode(root.querySelector('#imp').value); done(); startWith(s); toast('Save imported.', '', 1); } catch (err) { toast('That code is not a valid save.', '', -1); } }
    });
  } }).then(() => { if (fromMenu && !S) showMainMenu(); });
}

function showSettings(fromMenu) {
  const html = `<div class="slider-row"><label>Graphics quality</label><select id="st-q">${['low', 'medium', 'high'].map((q) => `<option ${settings.quality === q ? 'selected' : ''}>${q}</option>`).join('')}</select><span></span></div>
    <div class="slider-row"><label>Bloom & glow</label><input type="checkbox" id="st-b" ${settings.bloom ? 'checked' : ''}><span></span></div>
    <div class="slider-row"><label>Shadows</label><input type="checkbox" id="st-s" ${settings.shadows ? 'checked' : ''}><span></span></div>
    <div class="slider-row"><label>Lock time of day</label><input type="checkbox" id="st-l" ${settings.lockTime ? 'checked' : ''}><span></span></div>
    <div class="slider-row"><label>Locked hour</label><input type="range" id="st-h" min="0" max="23.5" step="0.5" value="${settings.lockHour}"><span class="val" id="st-hv">${settings.lockHour}h</span></div>
    <div class="slider-row"><label>Music</label><input type="checkbox" id="st-m" ${settings.musicOn ? 'checked' : ''}><span></span></div>
    <div class="slider-row"><label>Music volume</label><input type="range" id="st-v" min="0" max="1" step="0.05" value="${settings.musicVol}"><span class="val" id="st-vv">${Math.round(settings.musicVol * 100)}%</span></div>
    <div class="slider-row"><label>Autosave monthly</label><input type="checkbox" id="st-a" ${settings.autosave ? 'checked' : ''}><span></span></div>
    <p class="note">The soundtrack is composed live and changes with the national mood: anthem, calm, campaign march, crisis. The sky runs a full day–night cycle every five minutes. Lower quality on older phones for smoother play.</p>`;
  modal({ kicker: 'Settings', title: 'Settings', html, onRender: (root) => {
    const apply = () => { settings = { quality: root.querySelector('#st-q').value, bloom: root.querySelector('#st-b').checked, shadows: root.querySelector('#st-s').checked, lockTime: root.querySelector('#st-l').checked, lockHour: +root.querySelector('#st-h').value, autosave: root.querySelector('#st-a').checked, musicOn: root.querySelector('#st-m').checked, musicVol: +root.querySelector('#st-v').value }; root.querySelector('#st-hv').textContent = settings.lockHour + 'h'; root.querySelector('#st-vv').textContent = Math.round(settings.musicVol * 100) + '%'; saveSettings(); engine.applySettings(settings); music.unlock(); music.setEnabled(settings.musicOn); music.setVolume(settings.musicVol); document.getElementById('music-btn')?.dispatchEvent(new Event('repaint')); };
    root.addEventListener('input', apply); root.addEventListener('change', apply);
  } });
}

function showHelp() {
  modal({ kicker: 'Guide', title: 'How to play', html: `<p><b>1 · Win the election.</b> You start as a candidate 45 days before polling day. Open <b>Politics</b> and take one campaign action per day. Press ▶ to advance time; ⏸ pauses. Speeds go up to 10 days per second.</p>
    <p><b>2 · Govern.</b> In the 3D office tap the <b>computer</b> (government systems), <b>documents</b> (inbox), <b>phone</b> (foreign leaders), <b>TV</b> (news), <b>door</b> (cabinet meeting) and <b>lectern</b> (press & speeches). The dock gives direct access to every department.</p>
    <p><b>3 · Economy.</b> Budgets and taxes go through Parliament. Spending lifts demand and services but grows debt; taxes fund it but cost popularity. Watch inflation, unemployment and the currency.</p>
    <p><b>4 · Politics.</b> Laws need 101 of 200 votes. If your party lacks a majority, invite coalition partners. Approval comes from 1,200 simulated citizens with jobs, incomes, needs and beliefs.</p>
    <p><b>5 · The world.</b> Seven AI nations pursue their own goals. Build trade and alliances, manage border disputes, and keep the military ready — but war is ruinous.</p>
    <p><b>6 · Survive.</b> You lose if you are voted out or impeached. Re-election comes every four years; Parliament is elected at the midpoint.</p>` });
}

init().catch((e) => { console.error(e); const l = $('#loading'); if (l) l.textContent = 'Failed to start: ' + e.message; });
// Debug handle for automated tests / power users (window.__bp.S is the live state).
window.__bp = { music, get S() { return S; }, setSpeed: (v) => setSpeed(v), openPanel: (n) => openPanel(n), setView: (v) => setView(v) };
