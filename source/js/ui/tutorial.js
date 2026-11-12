// Interactive tutorial: Cookie (Chief of Staff) spotlights parts of the screen and explains them.
// Some steps wait for the player to actually do the thing (open a panel, hold a rally, press play).
// Two chapters: 'campaign' (start of a new game) and 'govern' (right after the first election win).
// Progress is stored in the save (S.tutorial) so it survives reloads.
import { esc } from './dom.js';
import { portrait } from '../render/portraits.js';
import { ui } from './panels.js';

const q = (sel) => (sel ? document.querySelector(sel) : null);

function chapters(app) {
  const S = () => app.S;
  return {
    campaign: [
      { title: 'Welcome, candidate!', text: `I'm Cookie, your Chief of Staff. In <b>45 days</b> the nation votes for a new President. Let me show you how to win. You can skip me at any time.` },
      { target: '#kpis', title: 'The nation at a glance', text: 'These are the country\'s vital signs: approval, economic growth, inflation, unemployment, debt, your <b>political capital</b> and citizen happiness. Tap any of them to open its department.' },
      { target: '#clock', title: 'Time', text: 'The game is paused. Use ▶ to play and the arrows to speed up (up to 10 days per second). The game also pauses itself whenever you have a decision to make.' },
      { target: '[data-dock="politics"]', title: 'Open Politics', text: 'The campaign is run from the <b>Politics</b> department. Tap it now.', wait: () => app.panel === 'politics', auto: () => app.openPanel('politics'), onEnter: () => app.closePanel() },
      { target: () => q('#panel-body .card'), title: 'Your campaign hub', text: 'This shows the days left, your campaign funds and the latest poll. You get <b>one campaign action per day</b>, so use one every day.', onEnter: () => app.openPanel('politics') },
      { target: '[data-act="campaign"][data-a="rally"]', title: 'Hold a rally', text: 'Pick a city in the box, then tap <b>Hold rally</b>. Rallies give a big boost in that city. Plumeria, the capital, has the most voters.', wait: () => S().pol.campaign && S().pol.campaign.lastActionDay === S().day, auto: () => app.campaignRally(), onEnter: () => app.openPanel('politics') },
      { target: () => q('#panel-body .card .bar')?.parentElement?.parentElement, title: 'Watch the poll', text: 'Silver is a strong rival who leads the polls at the start. TV ads lift you everywhere, pledges win voters who care about one issue, and the <b>televised debate</b> (once per campaign) can swing the race. If nobody gets 50%, the top two go to a run-off.', onEnter: () => app.openPanel('politics') },
      { target: '.spd[data-speed="1"]', title: 'Start the clock', text: 'Press <b>play</b>. Come back to Politics every day for another action. Pausing (⏸) gives you time to think.', wait: () => app.speed > 0, auto: () => app.setSpeed(1) },
      { title: 'Good luck!', text: 'Win the election and I\'ll brief you on how to run the country. Tip: the <b>Capital</b>, <b>Office</b> and <b>World</b> buttons switch between the 3D views.' },
    ],
    govern: [
      { title: 'Congratulations, President!', text: 'Welcome to the <b>Oval Nest</b>, your office. Let me show you how to govern. The game is paused while I talk.', onEnter: () => { app.setSpeed(0); app.setView('office'); app.closePanel(); } },
      { title: 'Everything here works', text: 'Tap things in the office: the <b>computer</b> opens government systems, the <b>documents</b> are your inbox, the <b>phone</b> calls foreign leaders, the <b>TV</b> shows the news, the <b>door</b> calls a cabinet meeting and the <b>lectern</b> is for press conferences. Try the computer on the desk.', wait: () => app.panel === 'government', auto: () => app.openPanel('government') },
      { target: () => q('#panel-body .list-item'), title: 'Your cabinet', text: 'Each minister runs a department. <b>Department efficiency</b> depends on their competence and whether they specialise in that area. Replace weak ministers, and choose your Vice President here.', onEnter: () => app.openPanel('government') },
      { target: () => q('[data-act="press"]'), title: 'Speak to the nation', text: 'Press conferences, speeches and cabinet meetings raise or lower your approval depending on how you handle them. You can declare a <b>national emergency</b> when a real crisis hits.', onEnter: () => app.openPanel('government') },
      { target: () => q('[data-act="order"]'), title: 'Executive orders', text: 'Orders take effect immediately but cost <b>political capital</b>, which refills when approval is high. Some can be struck down by the courts.', onEnter: () => app.openPanel('government') },
      { target: '[data-dock="economy"]', title: 'The economy', text: 'Open <b>Economy</b>.', wait: () => app.panel === 'economy', auto: () => app.openPanel('economy') },
      { target: '[data-b="budget"]', title: 'Budget & taxes', text: 'Tap <b>Budget & taxes</b>.', wait: () => ui.tab.economy === 'budget', auto: () => { ui.tab.economy = 'budget'; app.openPanel('economy'); }, onEnter: () => app.openPanel('economy') },
      { target: () => q('#panel-body .slider-row'), title: 'Set the budget', text: 'Move the sliders to see projected revenue, spending and the expected <b>vote in Parliament</b> (101 of 200 needed). Tax rises are unpopular; spending helps services but grows debt. Submit when you\'re happy.', onEnter: () => { ui.tab.economy = 'budget'; app.openPanel('economy'); } },
      { target: '[data-dock="laws"]', title: 'Make laws', text: 'Open <b>Laws</b>.', wait: () => app.panel === 'laws', auto: () => app.openPanel('laws') },
      { target: () => q('[data-act="propose"]'), title: 'Propose legislation', text: 'Each bill shows its expected vote. Bills you introduce are voted on 14 days later. Parliament also sends you its own bills to <b>sign or veto</b>.', onEnter: () => app.openPanel('laws') },
      { target: '[data-dock="politics"]', title: 'Build a majority', text: 'Open <b>Politics</b>.', wait: () => app.panel === 'politics', auto: () => app.openPanel('politics') },
      { target: () => q('[data-act="invite"]'), title: 'Coalitions', text: 'If your coalition has fewer than <b>101 seats</b>, invite other parties to join. Parties that think like you are more likely to say yes. Watch your approval here too.', onEnter: () => app.openPanel('politics') },
      { target: '[data-dock="diplomacy"]', title: 'The world', text: 'Seven nations have their own leaders and goals. Open <b>Diplomacy</b>, or tap a country on the World map.', wait: () => app.panel === 'diplomacy', auto: () => app.openPanel('diplomacy') },
      { target: () => q('#panel-body .list-item[data-act="selCountry"]'), title: 'Foreign relations', text: 'Pick a nation to send envoys, sign trade deals and alliances, or impose sanctions. Look out for <b>border disputes</b>: the Corvid Union claims Feather Ridge.', onEnter: () => app.openPanel('diplomacy') },
      { target: '[data-dock="military"]', title: 'Defence', text: '<b>Military</b> covers readiness, research and deployments. If war comes, launch offensives and air strikes and call on your allies. Push the front line to +70 to win.' },
      { target: '[data-dock="inbox"]', title: 'Your inbox', text: 'Bills to sign, foreign proposals and the monthly briefing from your ministers land here. Random events like scandals, disasters and strikes pause the game and ask for your decision.' },
      { target: '[data-dock="menu"]', title: 'Menu', text: 'Save and load, export a save to another device, change settings and music, or <b>replay this tutorial</b>.' },
      { title: 'You\'re ready', text: 'Keep the economy growing and citizens happy, and keep Parliament on your side. Re-election comes in four years. Good luck, President!' },
    ],
  };
}

export class Tutorial {
  constructor(app) {
    this.app = app; this.chapter = null; this.i = 0; this.steps = [];
    const root = document.createElement('div'); root.id = 'tut'; root.className = 'hidden';
    root.innerHTML = `<div class="tut-spot"></div><div class="tut-bubble" role="dialog" aria-live="polite"><div class="row" style="align-items:flex-start"><img class="portrait" alt="Cookie"><div class="grow"><div class="tut-kicker"></div><div class="tut-title"></div></div></div><div class="tut-text"></div><div class="tut-foot"><button class="btn sm tut-skip">Skip tutorial</button><span class="grow"></span><button class="btn sm tut-back">Back</button><button class="btn sm primary tut-next">Next</button></div></div>`;
    document.body.appendChild(root);
    this.root = root; this.spot = root.querySelector('.tut-spot'); this.bubble = root.querySelector('.tut-bubble');
    root.querySelector('.tut-next').onclick = () => this.next();
    root.querySelector('.tut-back').onclick = () => this.go(this.i - 1);
    root.querySelector('.tut-skip').onclick = () => this.finish(true);
  }
  get active() { return !!this.chapter; }
  start(chapter, step = 0) {
    const S = this.app.S; if (!S) return;
    this.chapter = chapter; this.steps = chapters(this.app)[chapter];
    S.tutorial = { chapter, step };
    this.root.classList.remove('hidden');
    this.go(step);
  }
  resume() { const t = this.app.S?.tutorial; if (t && (t.chapter === 'campaign' || t.chapter === 'govern')) this.start(t.chapter, t.step); else this.stop(); }
  stop() { this.chapter = null; this.root.classList.add('hidden'); }
  go(i) {
    if (i < 0) i = 0;
    if (i >= this.steps.length) return this.finish(false);
    this.i = i; const st = this.steps[i];
    if (this.app.S) this.app.S.tutorial = { chapter: this.chapter, step: i };
    st.onEnter?.();
    const ch = this.app.S?.chars?.cookie;
    this.bubble.querySelector('img').src = portrait(ch);
    this.bubble.querySelector('.tut-kicker').textContent = `${this.chapter === 'campaign' ? 'Tutorial · The campaign' : 'Tutorial · Governing'} · ${i + 1}/${this.steps.length}`;
    this.bubble.querySelector('.tut-title').textContent = st.title;
    this.bubble.querySelector('.tut-text').innerHTML = st.text;
    this.bubble.querySelector('.tut-back').style.visibility = i ? 'visible' : 'hidden';
    const nb = this.bubble.querySelector('.tut-next');
    nb.textContent = st.wait ? 'Do it for me' : i === this.steps.length - 1 ? 'Finish' : 'Next';
    nb.classList.toggle('primary', !st.wait);
    this.doneWait = false;
    this.bubble.classList.remove('pop'); void this.bubble.offsetWidth; this.bubble.classList.add('pop');
    this.scrolled = false;
  }
  next() {
    const st = this.steps[this.i];
    if (st.wait && !st.wait()) { this.autoDo(st); }
    this.go(this.i + 1);
  }
  // "Do it for me": perform the waited-for action so nobody gets stuck.
  autoDo(st) { st.auto?.(); }
  finish(skipped) {
    const S = this.app.S, ch = this.chapter;
    if (S) S.tutorial = { chapter: ch === 'campaign' && !skipped ? 'await-govern' : 'done', step: 0 };
    this.stop();
    if (skipped) this.app.toast('Tutorial skipped. Replay it any time from Menu → Tutorial.');
  }
  // Called every frame by the game loop.
  update(modalOpen) {
    if (!this.chapter) return;
    this.root.style.display = modalOpen ? 'none' : '';
    if (modalOpen) return;
    const st = this.steps[this.i];
    if (st.wait && !this.doneWait && st.wait()) { this.doneWait = true; setTimeout(() => this.go(this.i + 1), 450); }
    let el = typeof st.target === 'function' ? st.target() : q(st.target);
    if (el && !el.offsetParent && el.id !== 'kpis') el = null;
    const vw = window.innerWidth, vh = window.innerHeight, bw = Math.min(380, vw - 24);
    this.bubble.style.width = bw + 'px';
    const bh = this.bubble.offsetHeight;
    if (el) {
      if (!this.scrolled && el.closest('#panel-body')) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); this.scrolled = true; }
      const r = el.getBoundingClientRect(), pad = 6;
      Object.assign(this.spot.style, { display: 'block', left: r.left - pad + 'px', top: r.top - pad + 'px', width: r.width + pad * 2 + 'px', height: r.height + pad * 2 + 'px' });
      let x, y;
      if (vw < 760) { x = 12; y = r.top > vh / 2 ? Math.max(8, r.top - bh - 18) : Math.min(vh - bh - 8, r.bottom + 18); }
      else {
        x = r.right + 18; y = r.top + r.height / 2 - bh / 2;
        if (x + bw > vw - 12) { x = r.left - bw - 18; }
        if (x < 12) { x = Math.min(Math.max(12, r.left), vw - bw - 12); y = r.bottom + 16 + bh > vh ? r.top - bh - 16 : r.bottom + 16; }
      }
      this.bubble.style.left = Math.max(12, Math.min(vw - bw - 12, x)) + 'px';
      this.bubble.style.top = Math.max(60, Math.min(vh - bh - 12, y)) + 'px';
    } else {
      this.spot.style.display = 'none';
      this.bubble.style.left = (vw - bw) / 2 + 'px';
      this.bubble.style.top = Math.max(70, vh * 0.5 - bh / 2 - (vw < 760 ? 60 : 0)) + 'px';
    }
  }
}
