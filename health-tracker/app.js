/* Vitals — Personal Health Tracker
   Local-first single-page app. Data lives in localStorage under STORAGE_KEY.
   Designed so a cloud backend can later replace the `store` layer without
   touching the views. See connections view for the API auto-pull roadmap. */
(function () {
  'use strict';

  const STORAGE_KEY = 'rpna_vitals_v1';
  const DOMAIN_KEYS = ['exercise', 'sleep', 'diet', 'body'];

  /* ---------------------------------------------------------------- store */
  const blank = () => ({
    exercise: [], sleep: [], diet: [], body: [],
    settings: { weightUnit: 'kg', distanceUnit: 'km' },
    connections: {}
  });

  const store = {
    data: null,
    load() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        this.data = raw ? Object.assign(blank(), JSON.parse(raw)) : blank();
      } catch (e) { this.data = blank(); }
      return this.data;
    },
    save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data)); },
    all(domain) {
      return (this.data[domain] || []).slice().sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    },
    add(domain, rec) {
      rec.id = rec.id || (crypto.randomUUID ? crypto.randomUUID() : 'id' + Date.now() + Math.round(Math.random() * 1e6));
      rec.source = rec.source || 'manual';
      this.data[domain].push(rec); this.save(); return rec;
    },
    update(domain, id, patch) {
      const i = this.data[domain].findIndex(r => r.id === id);
      if (i >= 0) { this.data[domain][i] = Object.assign({}, this.data[domain][i], patch); this.save(); }
    },
    remove(domain, id) {
      this.data[domain] = this.data[domain].filter(r => r.id !== id); this.save();
    },
    get settings() { return this.data.settings; }
  };

  /* ------------------------------------------------------------- helpers */
  const $ = (sel, root = document) => root.querySelector(sel);
  const el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const todayISO = () => new Date().toISOString().slice(0, 10);
  const num = (v) => { const n = parseFloat(v); return isNaN(n) ? null : n; };
  const fmt = (v, d = 1) => (v == null || v === '' || isNaN(v)) ? '—' : (Math.round(v * 10 ** d) / 10 ** d).toLocaleString();
  const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
  const fmtDate = (iso) => { if (!iso) return '—'; const d = new Date(iso + 'T00:00'); return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: '2-digit' }); };
  const KG_TO_LB = 2.20462, KM_TO_MI = 0.621371;
  const wUnit = () => store.settings.weightUnit;
  const dUnit = () => store.settings.distanceUnit;
  const dispWeight = (kg) => kg == null ? null : (wUnit() === 'lb' ? kg * KG_TO_LB : kg);
  const toKg = (v) => v == null ? null : (wUnit() === 'lb' ? v / KG_TO_LB : v);
  const dispDist = (km) => km == null ? null : (dUnit() === 'mi' ? km * KM_TO_MI : km);
  const toKm = (v) => v == null ? null : (dUnit() === 'mi' ? v / KM_TO_MI : v);

  const SOURCE_LABEL = { manual: 'Manual', strava: 'Strava', oura: 'Oura', apple: 'Apple Health', scanfit: 'ScanFit' };
  const sourcePill = (s) => `<span class="pill pill-${s === 'apple' ? 'apple' : (SOURCE_LABEL[s] ? s : 'manual')}">${esc(SOURCE_LABEL[s] || 'Manual')}</span>`;

  function toast(msg) {
    const t = el(`<div class="toast fade-in">${esc(msg)}</div>`);
    $('#toastRoot').appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; setTimeout(() => t.remove(), 300); }, 2200);
  }

  /* --------------------------------------------------------- domain config */
  const DOMAINS = {
    exercise: {
      label: 'Exercise', icon: '🏃', accent: '#FF8000',
      fields: [
        { key: 'date', label: 'Date', type: 'date', required: true, def: todayISO },
        { key: 'type', label: 'Activity', type: 'text', placeholder: 'Run, Ride, Strength…' },
        { key: 'durationMin', label: 'Duration (min)', type: 'number' },
        { key: 'distanceKm', label: () => `Distance (${dUnit()})`, type: 'number', step: '0.01', conv: { to: toKm, from: dispDist } },
        { key: 'calories', label: 'Calories', type: 'number' },
        { key: 'avgHr', label: 'Avg HR (bpm)', type: 'number' },
        { key: 'notes', label: 'Notes', type: 'text' }
      ],
      columns: ['date', 'type', 'durationMin', 'distanceKm', 'calories', 'avgHr']
    },
    sleep: {
      label: 'Sleep', icon: '🌙', accent: '#826edc',
      fields: [
        { key: 'date', label: 'Date (morning of)', type: 'date', required: true, def: todayISO },
        { key: 'totalSleepHr', label: 'Total sleep (h)', type: 'number', step: '0.1' },
        { key: 'timeInBedHr', label: 'Time in bed (h)', type: 'number', step: '0.1' },
        { key: 'efficiency', label: 'Efficiency (%)', type: 'number' },
        { key: 'hrv', label: 'HRV (ms)', type: 'number' },
        { key: 'restingHr', label: 'Resting HR (bpm)', type: 'number' },
        { key: 'readiness', label: 'Readiness score', type: 'number' },
        { key: 'notes', label: 'Notes', type: 'text' }
      ],
      columns: ['date', 'totalSleepHr', 'efficiency', 'hrv', 'restingHr', 'readiness']
    },
    diet: {
      label: 'Diet', icon: '🍽️', accent: '#4994A5',
      fields: [
        { key: 'date', label: 'Date', type: 'date', required: true, def: todayISO },
        { key: 'meal', label: 'Meal / item', type: 'text', placeholder: 'Breakfast, lunch…' },
        { key: 'calories', label: 'Calories (kcal)', type: 'number' },
        { key: 'protein', label: 'Protein (g)', type: 'number' },
        { key: 'carbs', label: 'Carbs (g)', type: 'number' },
        { key: 'fat', label: 'Fat (g)', type: 'number' },
        { key: 'notes', label: 'Notes', type: 'text' }
      ],
      columns: ['date', 'meal', 'calories', 'protein', 'carbs', 'fat']
    },
    body: {
      label: 'Body', icon: '⚖️', accent: '#FFC266',
      fields: [
        { key: 'date', label: 'Date', type: 'date', required: true, def: todayISO },
        { key: 'weightKg', label: () => `Weight (${wUnit()})`, type: 'number', step: '0.1', conv: { to: toKg, from: dispWeight } },
        { key: 'bodyFatPct', label: 'Body fat (%)', type: 'number', step: '0.1' },
        { key: 'muscleMassKg', label: () => `Muscle mass (${wUnit()})`, type: 'number', step: '0.1', conv: { to: toKg, from: dispWeight } },
        { key: 'waterPct', label: 'Body water (%)', type: 'number', step: '0.1' },
        { key: 'boneMassKg', label: () => `Bone mass (${wUnit()})`, type: 'number', step: '0.1', conv: { to: toKg, from: dispWeight } },
        { key: 'bmi', label: 'BMI', type: 'number', step: '0.1' },
        { key: 'notes', label: 'Notes', type: 'text' }
      ],
      columns: ['date', 'weightKg', 'bodyFatPct', 'muscleMassKg', 'waterPct', 'bmi']
    }
  };

  const colLabel = (domain, key) => {
    const f = DOMAINS[domain].fields.find(f => f.key === key);
    if (!f) return key;
    return typeof f.label === 'function' ? f.label() : f.label;
  };
  const cellVal = (domain, key, rec) => {
    const f = DOMAINS[domain].fields.find(f => f.key === key);
    let v = rec[key];
    if (v == null || v === '') return '—';
    if (f && f.conv) v = f.conv.from(v);
    if (key === 'date') return fmtDate(v);
    if (typeof v === 'number') return fmt(v, (f && f.step && f.step.includes('.')) ? (f.step === '0.01' ? 2 : 1) : 0);
    return esc(v);
  };

  /* ----------------------------------------------------------------- charts */
  const charts = {};
  function makeChart(id, cfg) {
    const ctx = document.getElementById(id);
    if (!ctx) return;
    if (typeof Chart === 'undefined') { // CDN slow/blocked — degrade gracefully instead of throwing
      ctx.closest('div').innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--color-text-muted);font-size:.85rem;">Chart library offline</div>';
      return;
    }
    if (charts[id]) charts[id].destroy();
    Chart.defaults.color = '#8497ad';
    Chart.defaults.font.family = 'Nunito, sans-serif';
    Chart.defaults.borderColor = 'rgba(255,255,255,0.06)';
    charts[id] = new Chart(ctx, cfg);
  }
  function destroyCharts() { Object.values(charts).forEach(c => c.destroy()); for (const k in charts) delete charts[k]; }

  /* --------------------------------------------------------------- routing */
  const NAV = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'exercise', label: 'Exercise', icon: '🏃' },
    { id: 'sleep', label: 'Sleep', icon: '🌙' },
    { id: 'diet', label: 'Diet', icon: '🍽️' },
    { id: 'body', label: 'Body', icon: '⚖️' },
    { id: 'import', label: 'Import', icon: '📥' },
    { id: 'connections', label: 'Connections', icon: '🔗' },
    { id: 'settings', label: 'Settings', icon: '⚙️' }
  ];

  function renderNav(active) {
    const nav = $('#nav'); nav.innerHTML = '';
    NAV.forEach(n => {
      const a = el(`<div class="nav-link ${n.id === active ? 'active' : ''}" data-route="${n.id}"><span class="ico">${n.icon}</span><span class="lbl">${n.label}</span></div>`);
      a.addEventListener('click', () => go(n.id));
      nav.appendChild(a);
    });
  }

  function go(route) {
    location.hash = route;
  }
  function currentRoute() {
    const r = (location.hash || '#dashboard').slice(1);
    return NAV.find(n => n.id === r) ? r : 'dashboard';
  }
  function render() {
    destroyCharts();
    const route = currentRoute();
    renderNav(route);
    const v = $('#view'); v.innerHTML = '';
    const node = (VIEWS[route] || VIEWS.dashboard)();
    node.classList.add('fade-in');
    v.appendChild(node);
    window.scrollTo(0, 0);
  }

  /* ----------------------------------------------------------------- views */
  const VIEWS = {};

  function pageHeader(title, subtitle, actionsHTML = '') {
    return `<div style="display:flex; align-items:flex-end; justify-content:space-between; gap:1rem; flex-wrap:wrap; margin-bottom:1.5rem;">
      <div>
        <h1 style="font-size:clamp(1.5rem,3vw,2rem); margin:0;">${esc(title)}</h1>
        <p style="color:var(--color-text-secondary); margin:.3rem 0 0;">${subtitle}</p>
      </div>
      <div style="display:flex; gap:.6rem;">${actionsHTML}</div>
    </div>`;
  }

  /* ---- Dashboard ---- */
  VIEWS.dashboard = function () {
    const wrap = el('<div></div>');
    const body = store.all('body'), sleep = store.all('sleep'), ex = store.all('exercise'), diet = store.all('diet');
    const latestW = body.find(r => r.weightKg != null);
    const prevW = body.filter(r => r.weightKg != null)[1];
    const latestBf = body.find(r => r.bodyFatPct != null);
    const lastSleep = sleep.find(r => r.totalSleepHr != null);
    const weekEx = ex.filter(r => r.date >= daysAgo(7));
    const weekDur = weekEx.reduce((s, r) => s + (num(r.durationMin) || 0), 0);
    const weekCal = weekEx.reduce((s, r) => s + (num(r.calories) || 0), 0);

    const wTrend = (latestW && prevW) ? (latestW.weightKg - prevW.weightKg) : null;
    const trendHTML = wTrend == null ? '' :
      `<span class="${wTrend <= 0 ? 'trend-down' : 'trend-up'}" style="font-size:.8rem; font-weight:700;">${wTrend > 0 ? '▲' : '▼'} ${fmt(Math.abs(dispWeight(Math.abs(wTrend))), 1)} ${wUnit()}</span>`;

    const card = (label, value, unit, extra = '', accent = 'var(--color-accent-1)') =>
      `<div class="card" style="padding:1.2rem 1.3rem;">
        <div style="font-size:.74rem; text-transform:uppercase; letter-spacing:.05em; color:var(--color-text-muted); font-weight:800;">${label}</div>
        <div style="display:flex; align-items:baseline; gap:.4rem; margin-top:.5rem;">
          <span class="stat-value" style="font-size:1.9rem; color:${accent};">${value}</span>
          <span style="color:var(--color-text-secondary); font-weight:600; font-size:.9rem;">${unit}</span>
        </div>
        <div style="margin-top:.4rem; min-height:18px;">${extra}</div>
      </div>`;

    const hasData = body.length + sleep.length + ex.length + diet.length > 0;

    wrap.innerHTML = pageHeader('Dashboard', `Your latest numbers at a glance · ${fmtDate(todayISO())}`,
      `<button class="btn btn-ghost" id="quickAdd">＋ Quick add</button>`) +
      (!hasData ? emptyState() : `
      <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:1rem; margin-bottom:1.5rem;">
        ${card('Weight', latestW ? fmt(dispWeight(latestW.weightKg), 1) : '—', latestW ? wUnit() : '', latestW ? trendHTML + `<span style="color:var(--color-text-muted); font-size:.74rem; margin-left:.4rem;">${fmtDate(latestW.date)}</span>` : '')}
        ${card('Body fat', latestBf ? fmt(latestBf.bodyFatPct, 1) : '—', latestBf ? '%' : '', '', 'var(--color-accent-2)')}
        ${card('Last sleep', lastSleep ? fmt(lastSleep.totalSleepHr, 1) : '—', lastSleep ? 'hrs' : '', lastSleep ? `<span style="color:var(--color-text-muted); font-size:.74rem;">${fmtDate(lastSleep.date)}</span>` : '', '#b3a4f0')}
        ${card('Exercise · 7d', fmt(weekDur, 0), 'min', `<span style="color:var(--color-text-muted); font-size:.74rem;">${weekEx.length} sessions · ${fmt(weekCal, 0)} kcal</span>`, 'var(--color-accent-3)')}
      </div>
      <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(320px,1fr)); gap:1.2rem;">
        <div class="card" style="padding:1.2rem;"><h3 style="margin:0 0 .8rem; font-size:1rem;">Weight trend</h3><div style="height:220px;"><canvas id="cWeight"></canvas></div></div>
        <div class="card" style="padding:1.2rem;"><h3 style="margin:0 0 .8rem; font-size:1rem;">Sleep · last 14 days</h3><div style="height:220px;"><canvas id="cSleep"></canvas></div></div>
        <div class="card" style="padding:1.2rem;"><h3 style="margin:0 0 .8rem; font-size:1rem;">Exercise volume · weekly</h3><div style="height:220px;"><canvas id="cEx"></canvas></div></div>
        <div class="card" style="padding:1.2rem;"><h3 style="margin:0 0 .8rem; font-size:1rem;">Calories in · last 14 days</h3><div style="height:220px;"><canvas id="cCal"></canvas></div></div>
      </div>
      <div class="card" style="padding:1.2rem; margin-top:1.2rem;">
        <h3 style="margin:0 0 .8rem; font-size:1rem;">Recent activity</h3>
        <div id="recentFeed"></div>
      </div>`);

    setTimeout(() => {
      if (!hasData) { const q = $('#quickAdd'); if (q) q.addEventListener('click', () => go('exercise')); return; }
      drawDashboardCharts();
      renderRecentFeed($('#recentFeed', wrap));
      $('#quickAdd').addEventListener('click', () => openEntryModal('exercise'));
    }, 0);
    return wrap;
  };

  function drawDashboardCharts() {
    const accent = '#FF8000';
    // Weight (last ~120 days)
    const body = store.all('body').filter(r => r.weightKg != null && r.date >= daysAgo(180)).reverse();
    makeChart('cWeight', {
      type: 'line',
      data: { labels: body.map(r => fmtDate(r.date)), datasets: [{ data: body.map(r => +dispWeight(r.weightKg).toFixed(1)), borderColor: accent, backgroundColor: 'rgba(255,128,0,0.12)', fill: true, tension: .35, pointRadius: 2, borderWidth: 2 }] },
      options: chartOpts(`${wUnit()}`)
    });
    // Sleep last 14d
    const sl = lastNDays(14).map(d => { const r = store.all('sleep').find(x => x.date === d); return { d, v: r ? num(r.totalSleepHr) : null }; });
    makeChart('cSleep', {
      type: 'bar',
      data: { labels: sl.map(x => fmtDate(x.d)), datasets: [{ data: sl.map(x => x.v), backgroundColor: 'rgba(179,164,240,0.65)', borderRadius: 5 }] },
      options: chartOpts('h')
    });
    // Exercise weekly volume (8 weeks)
    const weeks = [];
    for (let i = 7; i >= 0; i--) { const start = daysAgo(i * 7 + 6), end = daysAgo(i * 7); weeks.push({ start, end }); }
    const exData = weeks.map(w => store.all('exercise').filter(r => r.date >= w.start && r.date <= w.end).reduce((s, r) => s + (num(r.durationMin) || 0), 0));
    makeChart('cEx', {
      type: 'bar',
      data: { labels: weeks.map(w => fmtDate(w.end)), datasets: [{ data: exData, backgroundColor: 'rgba(73,148,165,0.7)', borderRadius: 5 }] },
      options: chartOpts('min')
    });
    // Calories last 14d
    const cal = lastNDays(14).map(d => { const tot = store.all('diet').filter(x => x.date === d).reduce((s, r) => s + (num(r.calories) || 0), 0); return tot || null; });
    makeChart('cCal', {
      type: 'line',
      data: { labels: lastNDays(14).map(fmtDate), datasets: [{ data: cal, borderColor: '#FFC266', backgroundColor: 'rgba(255,194,102,0.12)', fill: true, tension: .3, pointRadius: 2, borderWidth: 2 }] },
      options: chartOpts('kcal')
    });
  }

  function chartOpts(unit) {
    return {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => `${c.formattedValue} ${unit}` } } },
      scales: { x: { grid: { display: false }, ticks: { maxTicksLimit: 7, font: { size: 10 } } }, y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { font: { size: 10 } } } }
    };
  }
  function lastNDays(n) { const out = []; for (let i = n - 1; i >= 0; i--) out.push(daysAgo(i)); return out; }

  function renderRecentFeed(root) {
    const items = [];
    DOMAIN_KEYS.forEach(dk => store.all(dk).slice(0, 6).forEach(r => items.push({ dk, r })));
    items.sort((a, b) => (a.r.date < b.r.date ? 1 : -1));
    const top = items.slice(0, 8);
    if (!top.length) { root.innerHTML = '<p style="color:var(--color-text-muted);">No entries yet.</p>'; return; }
    root.innerHTML = top.map(({ dk, r }) => {
      const d = DOMAINS[dk];
      const summary = dk === 'exercise' ? `${esc(r.type || 'Activity')} · ${fmt(num(r.durationMin), 0)} min`
        : dk === 'sleep' ? `${fmt(num(r.totalSleepHr), 1)} h sleep`
          : dk === 'diet' ? `${esc(r.meal || 'Meal')} · ${fmt(num(r.calories), 0)} kcal`
            : `${fmt(dispWeight(num(r.weightKg)), 1)} ${wUnit()}${r.bodyFatPct ? ' · ' + fmt(num(r.bodyFatPct), 1) + '% fat' : ''}`;
      return `<div style="display:flex; align-items:center; gap:.8rem; padding:.5rem 0; border-bottom:1px solid rgba(255,255,255,0.05);">
        <span style="font-size:1.1rem;">${d.icon}</span>
        <span style="flex:1;">${summary}</span>
        ${sourcePill(r.source)}
        <span style="color:var(--color-text-muted); font-size:.8rem; min-width:70px; text-align:right;">${fmtDate(r.date)}</span>
      </div>`;
    }).join('');
  }

  function emptyState() {
    return `<div class="card" style="padding:3rem 2rem; text-align:center;">
      <div style="font-size:2.5rem; margin-bottom:.5rem;">📈</div>
      <h3 style="margin:0 0 .5rem;">No data yet</h3>
      <p style="color:var(--color-text-secondary); max-width:440px; margin:0 auto 1.4rem;">Add your first entry, import a CSV / Apple Health export, or load sample data to see the dashboard come alive.</p>
      <div style="display:flex; gap:.6rem; justify-content:center; flex-wrap:wrap;">
        <button class="btn btn-primary" onclick="location.hash='exercise'">＋ Add an entry</button>
        <button class="btn btn-ghost" onclick="location.hash='import'">📥 Import data</button>
        <button class="btn btn-ghost" id="loadSample">✨ Load sample data</button>
      </div>
    </div>`;
  }

  /* ---- Domain list view (generic) ---- */
  DOMAIN_KEYS.forEach(dk => {
    VIEWS[dk] = function () {
      const d = DOMAINS[dk];
      const rows = store.all(dk);
      const wrap = el('<div></div>');
      wrap.innerHTML = pageHeader(d.label, `${rows.length} ${rows.length === 1 ? 'entry' : 'entries'}`,
        `<button class="btn btn-ghost" data-imp>📥 Import</button><button class="btn btn-primary" data-add>＋ Add ${d.label.toLowerCase()}</button>`);
      const tableCard = el(`<div class="card" style="padding:.4rem .4rem; overflow:auto;"></div>`);
      if (!rows.length) {
        tableCard.innerHTML = `<div style="padding:2.5rem; text-align:center; color:var(--color-text-secondary);">No ${d.label.toLowerCase()} entries yet. <button class="btn btn-sm btn-primary" data-add2 style="margin-left:.5rem;">Add one</button></div>`;
      } else {
        tableCard.innerHTML = `<table><thead><tr>${d.columns.map(c => `<th>${esc(colLabel(dk, c))}</th>`).join('')}<th>Source</th><th></th></tr></thead>
          <tbody>${rows.map(r => `<tr>${d.columns.map(c => `<td>${cellVal(dk, c, r)}</td>`).join('')}<td>${sourcePill(r.source)}</td>
            <td style="text-align:right; white-space:nowrap;">
              <button class="btn btn-sm btn-ghost" data-edit="${r.id}">Edit</button>
              <button class="btn btn-sm btn-danger" data-del="${r.id}">✕</button></td></tr>`).join('')}</tbody></table>`;
      }
      wrap.appendChild(tableCard);
      wrap.addEventListener('click', (e) => {
        const t = e.target.closest('button'); if (!t) return;
        if (t.matches('[data-add],[data-add2]')) openEntryModal(dk);
        else if (t.hasAttribute('data-imp')) go('import');
        else if (t.hasAttribute('data-edit')) openEntryModal(dk, store.all(dk).find(r => r.id === t.getAttribute('data-edit')));
        else if (t.hasAttribute('data-del')) { if (confirm('Delete this entry?')) { store.remove(dk, t.getAttribute('data-del')); toast('Entry deleted'); render(); } }
      });
      return wrap;
    };
  });

  /* ---- Entry modal ---- */
  function openEntryModal(domain, existing) {
    const d = DOMAINS[domain];
    const sourceOpts = ['manual', 'strava', 'oura', 'apple', 'scanfit'];
    const back = el(`<div class="modal-backdrop"></div>`);
    const inputs = d.fields.map(f => {
      const label = typeof f.label === 'function' ? f.label() : f.label;
      let val = existing ? existing[f.key] : (f.def ? f.def() : '');
      if (existing && f.conv && val != null && val !== '') val = +(+f.conv.from(val)).toFixed(2);
      return `<div class="field"><label>${esc(label)}</label>
        <input class="input" name="${f.key}" type="${f.type}" ${f.step ? `step="${f.step}"` : ''} ${f.placeholder ? `placeholder="${esc(f.placeholder)}"` : ''} value="${val == null ? '' : esc(val)}"></div>`;
    }).join('');
    const modal = el(`<div class="card modal fade-in" style="padding:1.6rem;">
      <h2 style="margin:0 0 1.2rem; font-size:1.3rem;">${existing ? 'Edit' : 'Add'} ${d.label.toLowerCase()} entry</h2>
      <form id="entryForm" style="display:grid; grid-template-columns:1fr 1fr; gap:.9rem;">
        ${inputs}
        <div class="field"><label>Source</label><select class="input" name="source">${sourceOpts.map(s => `<option value="${s}" ${existing && existing.source === s ? 'selected' : ''}>${SOURCE_LABEL[s]}</option>`).join('')}</select></div>
      </form>
      <div style="display:flex; justify-content:flex-end; gap:.6rem; margin-top:1.4rem;">
        <button class="btn btn-ghost" data-cancel>Cancel</button>
        <button class="btn btn-primary" data-save>${existing ? 'Save changes' : 'Add entry'}</button>
      </div></div>`);
    back.appendChild(modal);
    $('#modalRoot').appendChild(back);
    const close = () => back.remove();
    back.addEventListener('click', e => { if (e.target === back) close(); });
    modal.querySelector('[data-cancel]').addEventListener('click', close);
    modal.querySelector('[data-save]').addEventListener('click', () => {
      const form = modal.querySelector('#entryForm');
      const rec = {};
      d.fields.forEach(f => {
        let raw = form.elements[f.key].value.trim();
        if (raw === '') { rec[f.key] = null; return; }
        if (f.type === 'number') { let v = num(raw); if (f.conv) v = f.conv.to(v); rec[f.key] = v; }
        else rec[f.key] = raw;
      });
      rec.source = form.elements.source.value;
      if (!rec.date) { toast('Date is required'); return; }
      if (existing) { store.update(domain, existing.id, rec); toast('Entry updated'); }
      else { store.add(domain, rec); toast(`${d.label} entry added`); }
      close(); render();
    });
    return back;
  }

  /* ---- Import view ---- */
  VIEWS.import = function () {
    const wrap = el('<div></div>');
    wrap.innerHTML = pageHeader('Import data', 'Bring in a CSV export, an Apple Health export, or a Vitals backup') + `
      <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(300px,1fr)); gap:1.2rem;">
        <div class="card" style="padding:1.4rem;">
          <h3 style="margin:0 0 .4rem;">📄 CSV import</h3>
          <p style="color:var(--color-text-secondary); font-size:.9rem; margin:0 0 1rem;">Upload or paste a CSV. Columns are auto-matched to fields (e.g. <em>date, weight, body fat</em>); review the mapping before importing.</p>
          <div class="field" style="margin-bottom:.8rem;"><label>Target</label>
            <select class="input" id="csvDomain">${DOMAIN_KEYS.map(k => `<option value="${k}">${DOMAINS[k].label}</option>`).join('')}</select></div>
          <input type="file" id="csvFile" accept=".csv,text/csv" class="input" style="margin-bottom:.8rem; padding:.45rem;">
          <textarea class="input" id="csvText" rows="5" placeholder="…or paste CSV text here (first row = headers)"></textarea>
          <button class="btn btn-primary btn-sm" id="csvParse" style="margin-top:.9rem;">Preview mapping →</button>
          <div id="csvMap"></div>
        </div>
        <div class="card" style="padding:1.4rem;">
          <h3 style="margin:0 0 .4rem;">🍎 Apple Health export</h3>
          <p style="color:var(--color-text-secondary); font-size:.9rem; margin:0 0 1rem;">Apple has no cloud API, so data comes from the phone. On iPhone: <strong>Health app → profile → Export All Health Data</strong>. Unzip and upload <code>export.xml</code> here — workouts, sleep, weight and body-fat are imported.</p>
          <input type="file" id="appleFile" accept=".xml,text/xml" class="input" style="padding:.45rem;">
          <div id="appleStatus" style="margin-top:.8rem; font-size:.85rem; color:var(--color-text-muted);"></div>
          <p style="color:var(--color-text-muted); font-size:.8rem; margin:1rem 0 0;">Tip: the <em>Health Auto Export</em> app can post this data to a webhook automatically once the cloud backend is enabled — see Connections.</p>
        </div>
        <div class="card" style="padding:1.4rem;">
          <h3 style="margin:0 0 .4rem;">💾 Vitals backup</h3>
          <p style="color:var(--color-text-secondary); font-size:.9rem; margin:0 0 1rem;">Restore a full backup exported from Settings. This replaces all current data.</p>
          <input type="file" id="backupFile" accept=".json,application/json" class="input" style="padding:.45rem;">
        </div>
      </div>`;

    setTimeout(() => {
      $('#csvParse', wrap).addEventListener('click', () => previewCSV(wrap));
      $('#csvFile', wrap).addEventListener('change', e => readFile(e.target.files[0], txt => { $('#csvText', wrap).value = txt; previewCSV(wrap); }));
      $('#appleFile', wrap).addEventListener('change', e => readFile(e.target.files[0], txt => importAppleHealth(txt, wrap)));
      $('#backupFile', wrap).addEventListener('change', e => readFile(e.target.files[0], txt => restoreBackup(txt)));
    }, 0);
    return wrap;
  };

  function readFile(file, cb) { if (!file) return; const r = new FileReader(); r.onload = () => cb(r.result); r.readAsText(file); }

  function parseCSV(text) {
    const rows = []; let row = [], cur = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
      else if (c === '"') q = true;
      else if (c === ',') { row.push(cur); cur = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); if (row.some(x => x !== '')) rows.push(row); row = []; cur = ''; }
      else cur += c;
    }
    if (cur !== '' || row.length) { row.push(cur); if (row.some(x => x !== '')) rows.push(row); }
    return rows;
  }

  const SYNONYMS = {
    date: ['date', 'day', 'start_date', 'start date', 'datetime', 'time', 'timestamp'],
    type: ['type', 'activity', 'activity type', 'name', 'sport', 'workout'],
    durationMin: ['duration', 'duration (min)', 'minutes', 'moving time', 'elapsed time', 'time (min)'],
    distanceKm: ['distance', 'distance (km)', 'km', 'distance km'],
    calories: ['calories', 'kcal', 'energy', 'active calories', 'cal'],
    avgHr: ['avg hr', 'average hr', 'heart rate', 'avg heart rate', 'hr'],
    totalSleepHr: ['total sleep', 'sleep duration', 'asleep', 'hours', 'sleep (h)', 'total sleep (h)', 'sleep'],
    timeInBedHr: ['time in bed', 'in bed', 'bed time'],
    efficiency: ['efficiency', 'sleep efficiency'],
    hrv: ['hrv', 'heart rate variability', 'rmssd'],
    restingHr: ['resting hr', 'resting heart rate', 'rhr', 'lowest hr'],
    readiness: ['readiness', 'readiness score', 'score'],
    weightKg: ['weight', 'weight (kg)', 'kg', 'mass', 'body weight'],
    bodyFatPct: ['body fat', 'fat', 'body fat %', 'fat %', 'bodyfat'],
    muscleMassKg: ['muscle', 'muscle mass', 'muscle (kg)'],
    waterPct: ['water', 'body water', 'water %'],
    boneMassKg: ['bone', 'bone mass'],
    bmi: ['bmi'],
    meal: ['meal', 'food', 'item', 'description', 'name'],
    protein: ['protein', 'protein (g)'],
    carbs: ['carbs', 'carbohydrate', 'carbohydrates', 'carbs (g)'],
    fat: ['fat', 'fats', 'fat (g)']
  };

  function autoMatch(header, domain) {
    const h = header.toLowerCase().trim();
    const fields = DOMAINS[domain].fields.map(f => f.key);
    for (const key of fields) {
      const syns = SYNONYMS[key] || [key];
      if (syns.some(s => h === s)) return key;
    }
    for (const key of fields) {
      const syns = SYNONYMS[key] || [key];
      if (syns.some(s => h.includes(s) || s.includes(h))) return key;
    }
    return '';
  }

  function previewCSV(wrap) {
    const domain = $('#csvDomain', wrap).value;
    const text = $('#csvText', wrap).value.trim();
    const mapBox = $('#csvMap', wrap);
    if (!text) { mapBox.innerHTML = '<p style="color:var(--color-bad); font-size:.85rem; margin-top:.8rem;">Paste or choose a CSV first.</p>'; return; }
    const rows = parseCSV(text);
    if (rows.length < 2) { mapBox.innerHTML = '<p style="color:var(--color-bad); font-size:.85rem; margin-top:.8rem;">Need a header row plus at least one data row.</p>'; return; }
    const headers = rows[0];
    const fieldOpts = [{ k: '', l: '— ignore —' }].concat(DOMAINS[domain].fields.map(f => ({ k: f.key, l: typeof f.label === 'function' ? f.label() : f.label })));
    mapBox.innerHTML = `<div style="margin-top:1rem; border-top:1px solid var(--color-glass-border); padding-top:1rem;">
      <div style="font-weight:700; margin-bottom:.6rem; font-size:.9rem;">Map columns (${rows.length - 1} rows)</div>
      <div style="display:grid; gap:.5rem; max-height:240px; overflow:auto;">
        ${headers.map((h, i) => `<div style="display:flex; align-items:center; gap:.6rem;">
          <span style="flex:1; font-size:.85rem; color:var(--color-text-secondary); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${esc(h)}</span>
          <span style="color:var(--color-text-muted);">→</span>
          <select class="input" data-col="${i}" style="flex:1; padding:.4rem .6rem; font-size:.85rem;">
            ${fieldOpts.map(o => `<option value="${o.k}" ${autoMatch(h, domain) === o.k ? 'selected' : ''}>${esc(o.l)}</option>`).join('')}
          </select></div>`).join('')}
      </div>
      <button class="btn btn-primary btn-sm" id="csvCommit" style="margin-top:1rem;">Import ${rows.length - 1} rows</button>
      <span style="color:var(--color-text-muted); font-size:.8rem; margin-left:.6rem;">Source tagged as “Imported”. Numbers use your current units.</span>
    </div>`;
    $('#csvCommit', wrap).addEventListener('click', () => commitCSV(wrap, domain, rows));
  }

  function commitCSV(wrap, domain, rows) {
    const headers = rows[0];
    const mapping = {};
    wrap.querySelectorAll('[data-col]').forEach(s => { if (s.value) mapping[+s.getAttribute('data-col')] = s.value; });
    if (!Object.values(mapping).includes('date')) { toast('Map a column to Date first'); return; }
    const d = DOMAINS[domain]; let added = 0;
    rows.slice(1).forEach(r => {
      const rec = { source: 'manual' };
      for (const ci in mapping) {
        const key = mapping[ci]; let raw = (r[ci] || '').trim(); if (raw === '') continue;
        const f = d.fields.find(f => f.key === key);
        if (key === 'date') { const m = raw.match(/\d{4}-\d{2}-\d{2}/); rec.date = m ? m[0] : new Date(raw).toISOString().slice(0, 10); }
        else if (f && f.type === 'number') { let v = num(raw); if (v != null && f.conv) v = f.conv.to(v); if (v != null) rec[key] = v; }
        else rec[key] = raw;
      }
      if (rec.date && !isNaN(new Date(rec.date))) { store.add(domain, rec); added++; }
    });
    toast(`Imported ${added} ${d.label.toLowerCase()} ${added === 1 ? 'row' : 'rows'}`);
    go(domain);
  }

  /* ---- Apple Health XML import (workouts, sleep, weight, body fat) ---- */
  function importAppleHealth(xmlText, wrap) {
    const status = $('#appleStatus', wrap);
    status.textContent = 'Parsing… (large exports can take a moment)';
    setTimeout(() => {
      let counts = { exercise: 0, sleep: 0, body: 0 };
      try {
        const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
        // Workouts
        doc.querySelectorAll('Workout').forEach(w => {
          const date = (w.getAttribute('startDate') || '').slice(0, 10); if (!date) return;
          const dur = num(w.getAttribute('duration'));
          const type = (w.getAttribute('workoutActivityType') || '').replace('HKWorkoutActivityType', '');
          let dist = null, cal = null;
          w.querySelectorAll('WorkoutStatistics').forEach(s => {
            const t = s.getAttribute('type') || '';
            if (t.includes('DistanceWalkingRunning') || t.includes('DistanceCycling')) dist = num(s.getAttribute('sum'));
            if (t.includes('ActiveEnergyBurned')) cal = num(s.getAttribute('sum'));
          });
          store.add('exercise', { date, type, durationMin: dur ? +dur.toFixed(0) : null, distanceKm: dist, calories: cal ? +cal.toFixed(0) : null, source: 'apple' });
          counts.exercise++;
        });
        // Weight & body fat records → grouped by date
        const bodyByDate = {};
        doc.querySelectorAll('Record').forEach(rec => {
          const type = rec.getAttribute('type') || '';
          const date = (rec.getAttribute('startDate') || '').slice(0, 10); if (!date) return;
          const val = num(rec.getAttribute('value'));
          if (type.includes('BodyMass') && !type.includes('Index')) { bodyByDate[date] = bodyByDate[date] || { date, source: 'apple' }; bodyByDate[date].weightKg = val; }
          else if (type.includes('BodyFatPercentage')) { bodyByDate[date] = bodyByDate[date] || { date, source: 'apple' }; bodyByDate[date].bodyFatPct = val != null ? +(val * 100).toFixed(1) : null; }
          else if (type.includes('BodyMassIndex')) { bodyByDate[date] = bodyByDate[date] || { date, source: 'apple' }; bodyByDate[date].bmi = val; }
        });
        Object.values(bodyByDate).forEach(b => { store.add('body', b); counts.body++; });
        // Sleep analysis → total asleep hours per night
        const sleepByDate = {};
        doc.querySelectorAll('Record[type="HKCategoryTypeIdentifierSleepAnalysis"]').forEach(rec => {
          const v = rec.getAttribute('value') || '';
          if (!v.includes('Asleep')) return;
          const start = new Date(rec.getAttribute('startDate')), end = new Date(rec.getAttribute('endDate'));
          if (isNaN(start) || isNaN(end)) return;
          const date = end.toISOString().slice(0, 10);
          sleepByDate[date] = (sleepByDate[date] || 0) + (end - start) / 3600000;
        });
        Object.entries(sleepByDate).forEach(([date, hrs]) => { store.add('sleep', { date, totalSleepHr: +hrs.toFixed(1), source: 'apple' }); counts.sleep++; });
      } catch (e) {
        status.innerHTML = `<span style="color:var(--color-bad);">Could not parse that file — make sure it is the Apple Health <code>export.xml</code>.</span>`; return;
      }
      const total = counts.exercise + counts.sleep + counts.body;
      if (!total) { status.innerHTML = '<span style="color:var(--color-warn);">No recognised workouts, sleep, weight or body-fat records found.</span>'; return; }
      status.innerHTML = `<span style="color:var(--color-good);">✓ Imported ${counts.exercise} workouts, ${counts.sleep} sleep nights, ${counts.body} body records.</span>`;
      toast(`Apple Health: ${total} records imported`);
    }, 30);
  }

  function restoreBackup(text) {
    try {
      const obj = JSON.parse(text);
      if (!DOMAIN_KEYS.every(k => Array.isArray(obj[k]))) throw new Error('bad');
      if (!confirm('Restore this backup? It replaces all current data.')) return;
      store.data = Object.assign(blank(), obj); store.save();
      toast('Backup restored'); go('dashboard');
    } catch (e) { toast('That is not a valid Vitals backup file'); }
  }

  /* ---- Connections view ---- */
  VIEWS.connections = function () {
    const wrap = el('<div></div>');
    const conn = [
      { id: 'strava', name: 'Strava', icon: '🚴', pull: true, color: '#fc4c02',
        status: 'Auto-pull ready', detail: 'Full OAuth2 REST API. Imports runs, rides and workouts with distance, time, calories and heart rate.',
        steps: ['Create an app at strava.com/settings/api', 'Add your Client ID & Secret to the backend (Settings → API keys, once cloud sync is on)', 'Authorise once — activities then sync automatically every few hours'] },
      { id: 'oura', name: 'Oura', icon: '💍', pull: true, color: '#826edc',
        status: 'Auto-pull ready', detail: 'OAuth2 REST API (v2). Imports sleep, readiness, HRV and resting heart rate. Note: personal access tokens were retired in Dec 2025, so this uses the OAuth flow.',
        steps: ['Register an app at cloud.ouraring.com/oauth/applications', 'Add Client ID & Secret to the backend', 'Authorise once — daily sleep & readiness sync automatically'] },
      { id: 'apple', name: 'Apple Health', icon: '🍎', pull: false, color: '#e8edf4',
        status: 'Import / webhook', detail: 'Apple provides no cloud API — data lives on your iPhone. Use the manual export.xml import (see Import), or the Health Auto Export app to POST data to a webhook on a schedule once cloud sync is on.',
        steps: ['Now: Health app → Export All Health Data → upload export.xml under Import', 'Later: point the Health Auto Export app at your webhook for hands-off syncing'] },
      { id: 'scanfit', name: 'ScanFit scales', icon: '⚖️', pull: false, color: '#4994A5',
        status: 'Manual / CSV', detail: 'No public developer API is available for ScanFit. Export from the ScanFit app (or read off the display) and add weight & body-composition via manual entry or CSV import.',
        steps: ['Export a CSV from the ScanFit app if available → Import → Body', 'Otherwise add weigh-ins manually under Body'] }
    ];
    wrap.innerHTML = pageHeader('Connections', 'How each source feeds into Vitals — two auto-pull, two import-based') + `
      <div class="card" style="padding:1rem 1.2rem; margin-bottom:1.2rem; border-color:rgba(255,128,0,0.3); background:rgba(255,128,0,0.05);">
        <strong>Live auto-pull (Strava & Oura)</strong> needs a small backend to hold the API secrets and refresh tokens — that switches on with cloud sync. Until then, everything works through manual entry and the importers, and your data is yours on this device.
      </div>
      <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(300px,1fr)); gap:1.2rem;">
        ${conn.map(c => `<div class="card" style="padding:1.4rem;">
          <div style="display:flex; align-items:center; gap:.7rem; margin-bottom:.6rem;">
            <span style="font-size:1.6rem;">${c.icon}</span>
            <div style="flex:1;"><div style="font-weight:800; font-size:1.05rem;">${c.name}</div>
            <span class="pill" style="background:${c.pull ? 'rgba(76,175,125,0.18)' : 'rgba(132,151,173,0.18)'}; color:${c.pull ? '#7fd6a8' : '#b8c6d8'};">${c.status}</span></div>
          </div>
          <p style="color:var(--color-text-secondary); font-size:.88rem; margin:.4rem 0 .9rem;">${c.detail}</p>
          <ol style="margin:0; padding-left:1.1rem; color:var(--color-text-muted); font-size:.82rem; line-height:1.6;">
            ${c.steps.map(s => `<li>${s}</li>`).join('')}</ol>
        </div>`).join('')}
      </div>`;
    return wrap;
  };

  /* ---- Settings view ---- */
  VIEWS.settings = function () {
    const wrap = el('<div></div>');
    const counts = DOMAIN_KEYS.reduce((s, k) => s + store.all(k).length, 0);
    wrap.innerHTML = pageHeader('Settings', 'Units, backup and data management') + `
      <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(300px,1fr)); gap:1.2rem;">
        <div class="card" style="padding:1.4rem;">
          <h3 style="margin:0 0 1rem;">Units</h3>
          <div class="field" style="margin-bottom:1rem;"><label>Weight</label>
            <select class="input" id="wUnit"><option value="kg" ${wUnit() === 'kg' ? 'selected' : ''}>Kilograms (kg)</option><option value="lb" ${wUnit() === 'lb' ? 'selected' : ''}>Pounds (lb)</option></select></div>
          <div class="field"><label>Distance</label>
            <select class="input" id="dUnit"><option value="km" ${dUnit() === 'km' ? 'selected' : ''}>Kilometres (km)</option><option value="mi" ${dUnit() === 'mi' ? 'selected' : ''}>Miles (mi)</option></select></div>
          <p style="color:var(--color-text-muted); font-size:.8rem; margin:.9rem 0 0;">Stored internally in metric; this only changes display & entry.</p>
        </div>
        <div class="card" style="padding:1.4rem;">
          <h3 style="margin:0 0 .6rem;">Backup</h3>
          <p style="color:var(--color-text-secondary); font-size:.88rem; margin:0 0 1rem;">${counts} entries stored on this device. Export a JSON backup regularly — clearing browser data will erase local entries.</p>
          <button class="btn btn-primary btn-sm" id="exportBtn">⬇ Export backup</button>
          <button class="btn btn-ghost btn-sm" onclick="location.hash='import'">⬆ Restore</button>
        </div>
        <div class="card" style="padding:1.4rem; border-color:rgba(217,106,106,0.3);">
          <h3 style="margin:0 0 .6rem;">Danger zone</h3>
          <p style="color:var(--color-text-secondary); font-size:.88rem; margin:0 0 1rem;">Load demo data to explore, or wipe everything and start fresh.</p>
          <button class="btn btn-ghost btn-sm" id="sampleBtn">✨ Load sample data</button>
          <button class="btn btn-danger btn-sm" id="clearBtn">🗑 Clear all data</button>
        </div>
      </div>`;
    setTimeout(() => {
      $('#wUnit', wrap).addEventListener('change', e => { store.settings.weightUnit = e.target.value; store.save(); toast('Units updated'); });
      $('#dUnit', wrap).addEventListener('change', e => { store.settings.distanceUnit = e.target.value; store.save(); toast('Units updated'); });
      $('#exportBtn', wrap).addEventListener('click', exportBackup);
      $('#sampleBtn', wrap).addEventListener('click', () => { loadSample(); toast('Sample data loaded'); go('dashboard'); });
      $('#clearBtn', wrap).addEventListener('click', () => { if (confirm('Delete ALL data on this device? This cannot be undone.')) { store.data = blank(); store.save(); toast('All data cleared'); go('dashboard'); } });
    }, 0);
    return wrap;
  };

  function exportBackup() {
    const blob = new Blob([JSON.stringify(store.data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `vitals-backup-${todayISO()}.json`;
    a.click(); URL.revokeObjectURL(a.href);
    toast('Backup downloaded');
  }

  /* ---- Sample data ---- */
  function loadSample() {
    const d = blank(); d.settings = store.settings;
    const rnd = (min, max) => Math.round((min + Math.random() * (max - min)) * 10) / 10;
    let w = 82;
    for (let i = 60; i >= 0; i--) {
      const date = daysAgo(i);
      if (i % 2 === 0) { w -= rnd(0, 0.2); d.body.push({ id: 'b' + i, date, weightKg: +w.toFixed(1), bodyFatPct: rnd(17, 21), muscleMassKg: rnd(38, 40), waterPct: rnd(55, 60), bmi: +(w / (1.82 * 1.82)).toFixed(1), source: i % 6 === 0 ? 'scanfit' : 'manual' }); }
      d.sleep.push({ id: 's' + i, date, totalSleepHr: rnd(6, 8.2), timeInBedHr: rnd(7, 8.8), efficiency: Math.round(rnd(82, 95)), hrv: Math.round(rnd(38, 65)), restingHr: Math.round(rnd(48, 58)), readiness: Math.round(rnd(70, 92)), source: 'oura' });
      if (i % 2 === 0 || i % 3 === 0) { const types = ['Run', 'Ride', 'Strength', 'Swim']; const t = types[i % 4]; d.exercise.push({ id: 'e' + i, date, type: t, durationMin: Math.round(rnd(30, 75)), distanceKm: t === 'Run' ? rnd(5, 12) : t === 'Ride' ? rnd(15, 40) : null, calories: Math.round(rnd(250, 650)), avgHr: Math.round(rnd(120, 155)), source: t === 'Strength' ? 'manual' : 'strava' }); }
      d.diet.push({ id: 'd' + i, date, meal: 'Daily total', calories: Math.round(rnd(1900, 2600)), protein: Math.round(rnd(120, 180)), carbs: Math.round(rnd(180, 280)), fat: Math.round(rnd(55, 90)), source: 'manual' });
    }
    store.data = d; store.save();
  }

  /* ------------------------------------------------------------- bootstrap */
  store.load();
  window.addEventListener('hashchange', render);
  document.addEventListener('click', e => {
    if (e.target.id === 'loadSample') { loadSample(); toast('Sample data loaded'); render(); }
  });
  render();
})();
