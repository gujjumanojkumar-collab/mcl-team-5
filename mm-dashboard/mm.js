/* mm.js - all calculations and drawing for the MM machine and spares monitor.
   Everything is kept in this browser (localStorage). All sample figures are MADE UP. */
(function () {
'use strict';

var HOURS_MONTH = 720;          // 30 days x 24 hours
var INDENT_TO_PO_NORM = 60;     // days we expect from indent to purchase order (made up)
var KEY = 'mm-monitor-v1';

/* ---------------- Sample data (made up) ---------------- */
var SAMPLE = {
  machines: [
    { id: 'SH-01', name: 'Electric rope shovel 10 m³', work: 'Overburden loading', unit: 'BCM', count: 1, avail: 82, util: 70, output: 600, value: 120, running: 14000, fixed: 5500000 },
    { id: 'HE-02', name: 'Hydraulic excavator 5 m³', work: 'Coal loading', unit: 't', count: 1, avail: 75, util: 55, output: 450, value: 160, running: 9000, fixed: 3000000 },
    { id: 'DP-07', name: 'Rear dumper 100 t', work: 'Overburden hauling', unit: 'BCM', count: 6, avail: 70, util: 50, output: 180, value: 60, running: 6500, fixed: 1200000 },
    { id: 'DR-03', name: 'Blast-hole drill 250 mm', work: 'Drilling', unit: 'm', count: 1, avail: 78, util: 50, output: 28, value: 900, running: 5000, fixed: 900000 },
    { id: 'DP-11', name: 'Old rear dumper 85 t (14 years)', work: 'Coal hauling', unit: 'BCM', count: 1, avail: 45, util: 50, output: 140, value: 60, running: 9000, fixed: 800000 }
  ],
  links: [
    { from: 'DR-03', to: 'SH-01', buffer: 4, idled: 1, why: 'blasted rock in hand runs out' },
    { from: 'SH-01', to: 'DP-07', buffer: 0, idled: 4, why: 'the dumpers on that shovel have nothing to carry' }
  ],
  spare: {
    machine: 'SH-01', item: 'Undercarriage assembly',
    aName: 'Original make (OEM)', aPrice: 20000000, aLife: 15000, aFit: 72, aLead: 180,
    bName: 'Rebuilt / other make', bPrice: 13000000, bLife: 9000, bFit: 72, bLead: 90
  },
  orders: [
    { id: 'PO-26-014', item: 'Undercarriage assembly (track set)', machine: 'SH-01', location: 'East quarry', supplier: 'Vendor A', value: 20000000, urgency: 'High', status: 'Resolved', indent: '2026-03-02', po: '2026-06-20', promised: '2026-09-30', required: '2026-09-15', actual: '2026-10-28', stopped: 1 },
    { id: 'PO-26-009', item: 'Engine overhaul kit', machine: 'DP-11', location: 'Coal bench 2', supplier: 'Vendor E', value: 1500000, urgency: 'Medium', status: 'Resolved', indent: '2026-02-10', po: '2026-05-30', promised: '2026-07-15', required: '2026-07-01', actual: '2026-08-20', stopped: 1 },
    { id: 'PO-26-021', item: 'Hoist rope set', machine: 'SH-01', location: 'East quarry', supplier: 'Vendor B', value: 1800000, urgency: 'Low', status: 'Resolved', indent: '2026-07-01', po: '2026-08-05', promised: '2026-09-20', required: '2026-10-01', actual: '2026-09-28', stopped: 0 },
    { id: 'PO-26-027', item: 'Drill bit and rod set', machine: 'DR-03', location: 'East quarry', supplier: 'Vendor C', value: 950000, urgency: 'High', status: 'In progress', indent: '2026-08-10', po: '2026-09-25', promised: '2026-10-25', required: '2026-11-05', actual: '', stopped: 1 },
    { id: 'PO-26-031', item: 'Tyres 27.00 R49 (set of 6)', machine: 'DP-07', location: 'Haul road 3', supplier: 'Vendor D', value: 7200000, urgency: 'High', status: 'In progress', indent: '2026-07-15', po: '2026-09-01', promised: '2026-11-10', required: '2026-11-20', actual: '', stopped: 1 },
    { id: 'PO-26-035', item: 'Swing motor', machine: 'HE-02', location: 'Coal bench 1', supplier: 'Vendor B', value: 2600000, urgency: 'Medium', status: 'Open', indent: '2026-09-05', po: '2026-10-20', promised: '2026-12-15', required: '2026-12-20', actual: '', stopped: 1 }
  ]
};

/* ---------------- Helpers ---------------- */
function clone(o) { return JSON.parse(JSON.stringify(o)); }
function $(id) { return document.getElementById(id); }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function num(v) { var n = parseFloat(v); return isFinite(n) ? n : 0; }
function rs(x) {
  var neg = x < 0, a = Math.abs(x), s;
  if (a >= 1e7) s = (a / 1e7).toFixed(a >= 1e8 ? 1 : 2) + ' Cr';
  else if (a >= 1e5) s = (a / 1e5).toFixed(1) + ' L';
  else s = Math.round(a).toLocaleString('en-IN');
  return (neg ? '− ' : '') + 'Rs ' + s;
}
function int(x) { return Math.round(x).toLocaleString('en-IN'); }
function qty(x) { return x >= 1e5 ? (x / 1e5).toFixed(1) + ' lakh' : int(x); }
function day(s) { if (!s) return null; var d = new Date(s + 'T00:00:00'); return isNaN(d) ? null : d; }
function diff(a, b) { return Math.round((b - a) / 864e5); }   // days from a to b
function fmtDate(s) { var d = day(s); return d ? d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '–'; }
function today() { var d = new Date(); d.setHours(0, 0, 0, 0); return d; }
function cssVar(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }

function showError(msg, e) {
  $('err').innerHTML = esc(msg) + (e ? '<code>' + esc(e && e.message ? e.message : e) + '</code>' : '');
}

/* ---------------- Saving ---------------- */
var S;
function load() {
  try { var t = localStorage.getItem(KEY); if (t) { var o = JSON.parse(t); if (o && o.machines && o.orders) return o; } } catch (e) {}
  return clone(SAMPLE);
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); $('saved').textContent = 'Saved in this browser.'; }
  catch (e) { $('saved').textContent = 'Could not save in this browser: ' + e.message; }
}
function machine(id) { for (var i = 0; i < S.machines.length; i++) if (S.machines[i].id === id) return S.machines[i]; return null; }

/* ---------------- Calculations ---------------- */
// One machine (figures per single machine, plus fleet profit for the whole count)
function calcMachine(m) {
  var fitHrs = HOURS_MONTH * num(m.avail) / 100;
  var hrsMonth = fitHrs * num(m.util) / 100;
  var earnHr = num(m.output) * num(m.value);
  var marginHr = earnHr - num(m.running);
  var profit = hrsMonth * marginHr - num(m.fixed);
  var breakEven = marginHr > 0 && fitHrs > 0 ? num(m.fixed) / (fitHrs * marginHr) * 100 : Infinity;
  var level = marginHr <= 0 ? 'bad' : profit < 0 ? 'warn' : 'ok';
  return { hrsMonth: hrsMonth, hrsDay: hrsMonth / 30, earnHr: earnHr, marginHr: marginHr, profit: profit,
           fleetProfit: profit * Math.max(1, num(m.count)), breakEven: breakEven, level: level,
           outputMonth: hrsMonth * num(m.output) };
}

// Domino: machine `id` stopped `days` days, `n` machines. Follow the links.
function domino(id, days, n, depth, seen) {
  var m = machine(id), out = [];
  if (!m || days <= 0 || n <= 0 || depth > 6 || seen[id]) return out;
  seen[id] = true;
  var c = calcMachine(m);
  out.push({ id: id, name: m.name, days: days, n: n, lost: days * n * c.hrsDay * Math.max(0, c.marginHr),
             lostQty: days * n * c.hrsDay * num(m.output), unit: m.unit, marginHr: c.marginHr, depth: depth });
  S.links.forEach(function (l) {
    if (l.from === id) out = out.concat(domino(l.to, days - num(l.buffer), num(l.idled), depth + 1, seen));
  });
  seen[id] = false;
  return out;
}

function calcOrder(o) {
  var now = today(), indent = day(o.indent), po = day(o.po), promised = day(o.promised),
      required = day(o.required), actual = day(o.actual);
  var end = actual || now;
  var r = {};
  r.received = !!actual;
  r.indentToPO = indent ? diff(indent, po || now) : 0;
  r.poPlaced = !!po;
  r.poToDelivery = po ? Math.max(0, diff(po, end)) : 0;
  r.late = promised ? Math.max(0, diff(promised, end)) : 0;
  r.idle = (num(o.stopped) > 0 && required) ? Math.max(0, diff(required, end)) : 0;
  r.chain = r.idle > 0 ? domino(o.machine, r.idle, num(o.stopped), 0, {}) : [];
  r.lost = r.chain.reduce(function (s, x) { return s + x.lost; }, 0);
  r.level = r.lost > 0 ? 'bad' : (r.idle > 0 || r.late > 0) ? 'warn' : 'ok';
  return r;
}

function calcSpare() {
  var sp = S.spare, m = machine(sp.machine) || S.machines[0];
  var c = calcMachine(m);
  function opt(p) {
    var price = num(sp[p + 'Price']), life = Math.max(1, num(sp[p + 'Life'])), fit = num(sp[p + 'Fit']);
    var fitLoss = fit * Math.max(0, c.marginHr);
    return { name: sp[p + 'Name'] || (p === 'a' ? 'Option A' : 'Option B'), price: price, life: life, lead: num(sp[p + 'Lead']),
             perHr: (price + fitLoss) / life, years: c.hrsMonth > 0 ? life / (c.hrsMonth * 12) : Infinity };
  }
  var A = opt('a'), B = opt('b');
  var r = { m: m, c: c, A: A, B: B };
  r.lifeOutput = A.life * num(m.output);
  r.lifeValue = r.lifeOutput * num(m.value);
  r.lifeMargin = A.life * c.marginHr;
  r.share = r.lifeValue > 0 ? A.price / r.lifeValue * 100 : Infinity;
  r.paybackHrs = c.marginHr > 0 ? A.price / c.marginHr : Infinity;
  r.paybackDays = c.hrsDay > 0 ? r.paybackHrs / c.hrsDay : Infinity;
  r.dayWithout = c.hrsDay * Math.max(0, c.marginHr);
  return r;
}

/* ---------------- Drawing: hero and summary ---------------- */
var charts = {};
function chartColors() {
  return { c1: cssVar('--c1'), c2: cssVar('--c2'), neg: cssVar('--neg'), grid: cssVar('--grid'), ink: cssVar('--muted') };
}
function baseOpts(col) {
  return {
    responsive: true, maintainAspectRatio: false, animation: false,
    interaction: { mode: 'nearest', intersect: false },
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { color: col.grid }, ticks: { color: col.ink } },
      y: { grid: { color: col.grid }, ticks: { color: col.ink } }
    }
  };
}
function drawChart(id, cfg) {
  if (!window.Chart) return;
  if (charts[id]) charts[id].destroy();
  charts[id] = new Chart($(id), cfg);
}

function renderSummary() {
  var mc = S.machines.map(function (m) { return { m: m, c: calcMachine(m) }; });
  var oc = S.orders.map(function (o) { return { o: o, r: calcOrder(o) }; });
  var fleet = mc.reduce(function (s, x) { return s + x.c.fleetProfit; }, 0);
  var losing = mc.filter(function (x) { return x.c.level !== 'ok'; });
  var lost = oc.reduce(function (s, x) { return s + x.r.lost; }, 0);
  var lateNow = oc.filter(function (x) { return !x.r.received && x.r.late > 0; });

  $('asOf').textContent = today().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  $('kProfit').textContent = rs(fleet);
  $('kProfit').className = 'v ' + (fleet >= 0 ? 'ok' : 'bad');
  $('kLosing').textContent = losing.length + ' of ' + mc.length;
  $('kLosing').className = 'v ' + (losing.length ? 'warn' : 'ok');
  $('kLost').textContent = rs(lost);
  $('kLate').textContent = String(lateNow.length);

  var worst = oc.slice().sort(function (a, b) { return b.r.lost - a.r.lost; })[0];
  if (lost > 0) {
    $('headline').innerHTML = 'Late spares cost <span class="hl">' + esc(rs(lost)) + '</span> in lost production';
    $('lede').innerHTML = 'The worst was <b>' + esc(worst.o.item) + '</b> for ' + esc(worst.o.machine) + ': it came ' + worst.r.idle +
      ' days after it was needed and, with the machines that stopped after it, cost <b>' + esc(rs(worst.r.lost)) + '</b>' +
      (num(worst.o.value) > 0 ? ' — ' + (worst.r.lost / num(worst.o.value)).toFixed(1) + ' times the price of the spare itself.' : '.');
  } else {
    $('headline').textContent = 'No machine is standing idle for a late spare';
    $('lede').textContent = 'Keep the purchase orders below up to date to see any delays early.';
  }

  // Actions
  var acts = [];
  mc.forEach(function (x) {
    if (x.c.level === 'bad') acts.push(['bad', 'Stop', '<b>' + esc(x.m.id) + ' ' + esc(x.m.name) + '</b> loses ' + esc(rs(-x.c.marginHr)) + ' every hour it runs. Do not buy big spares for it. Review it for disposal or a different job.']);
    else if (x.c.level === 'warn') acts.push(['warn', 'Watch', '<b>' + esc(x.m.id) + ' ' + esc(x.m.name) + '</b> covers its running cost but not its fixed cost. Raise utilisation from ' + num(x.m.util) + '% to ' +
      (isFinite(x.c.breakEven) && x.c.breakEven <= 100 ? Math.ceil(x.c.breakEven) + '%' : 'over 100% (not possible — cut cost instead)') + ' to break even.']);
  });
  oc.filter(function (x) { return x.r.lost > 0; }).sort(function (a, b) { return b.r.lost - a.r.lost; }).forEach(function (x) {
    acts.push(['bad', 'Delay', '<b>' + esc(x.o.item) + '</b> (' + esc(x.o.machine) + ', ' + esc(x.o.supplier) + '): ' + x.r.idle + ' idle days, ' + esc(rs(x.r.lost)) + ' lost' +
      (x.r.chain.length > 1 ? ' including ' + (x.r.chain.length - 1) + ' machine type(s) stopped by the domino' : '') + '.' + (x.r.received ? '' : ' <b>Still not received — chase the supplier.</b>')]);
  });
  oc.filter(function (x) { return !x.r.received && x.r.late > 0 && x.r.lost === 0; }).forEach(function (x) {
    acts.push(['warn', 'Chase', '<b>' + esc(x.o.item) + '</b> from ' + esc(x.o.supplier) + ' is ' + x.r.late + ' days past the promised date. The machine has not stopped yet.']);
  });
  oc.filter(function (x) { return x.r.idle > 0 && x.r.lost === 0; }).forEach(function (x) {
    acts.push(['plain', 'Note', '<b>' + esc(x.o.machine) + '</b> stood ' + x.r.idle + ' days for <b>' + esc(x.o.item) + '</b>, but this machine loses money when it runs, so the delay cost nothing in profit.']);
  });
  var slow = oc.filter(function (x) { return x.r.poPlaced; });
  if (slow.length) {
    var avg = slow.reduce(function (s, x) { return s + x.r.indentToPO; }, 0) / slow.length;
    if (avg > INDENT_TO_PO_NORM) acts.push(['warn', 'Process', 'Indent to purchase order takes <b>' + Math.round(avg) + ' days</b> on average against a norm of ' + INDENT_TO_PO_NORM + '. Start indents for long-lead spares earlier, or use rate contracts.']);
  }
  if (!acts.length) acts.push(['ok', 'Good', 'All machines are profitable and no supplies are late.']);
  $('actions').innerHTML = acts.map(function (a) { return '<li><span class="pill ' + a[0] + '">' + a[1] + '</span><span>' + a[2] + '</span></li>'; }).join('');

  // Profit chart
  var col = chartColors();
  var o = baseOpts(col);
  o.indexAxis = 'y';
  o.scales.x.ticks.callback = function (v) { return rs(v); };
  o.scales.y.grid.display = false;
  o.plugins.tooltip = { callbacks: { label: function (ctx) { return 'Profit per month: ' + rs(ctx.raw); } } };
  drawChart('profitChart', {
    type: 'bar',
    data: { labels: mc.map(function (x) { return x.m.id + (num(x.m.count) > 1 ? ' (×' + x.m.count + ')' : ''); }),
            datasets: [{ data: mc.map(function (x) { return Math.round(x.c.fleetProfit); }),
                         backgroundColor: mc.map(function (x) { return x.c.fleetProfit < 0 ? col.neg : col.c1; }),
                         borderRadius: 4, borderSkipped: false, maxBarThickness: 28 }] },
    options: o
  });
}

/* ---------------- Drawing: machine cards ---------------- */
var FIELDS = [
  ['count', 'How many'], ['avail', 'Availability %'], ['util', 'Utilisation %'], ['output', 'Output per working hour'],
  ['value', 'Value of 1 unit of work (Rs)'], ['running', 'Running cost per hour (Rs)'], ['fixed', 'Fixed cost per month, each (Rs)']
];
function buildMachineCards() {
  $('machineCards').innerHTML = S.machines.map(function (m, i) {
    return '<div class="panel mcard"><div class="head"><div><h3>' + esc(m.id) + ' · ' + esc(m.name) + '</h3><div class="sub">' + esc(m.work) + ' · output in ' + esc(m.unit) + '</div></div><span id="mPill' + i + '"></span></div>' +
      '<div class="fields three">' + FIELDS.map(function (f) {
        return '<label class="f">' + f[1] + '<input type="number" min="0" inputmode="decimal" data-m="' + i + '" data-k="' + f[0] + '" value="' + esc(m[f[0]]) + '"></label>';
      }).join('') + '</div><div class="results" id="mRes' + i + '"></div><p class="say" id="mSay' + i + '"></p></div>';
  }).join('');
}
function renderMachines() {
  S.machines.forEach(function (m, i) {
    var c = calcMachine(m);
    var label = { ok: 'Profitable', warn: 'Not covering fixed cost', bad: 'Loses money every hour' }[c.level];
    $('mPill' + i).className = 'pill ' + c.level; $('mPill' + i).textContent = label;
    $('mRes' + i).innerHTML =
      res('Working hours a month', int(c.hrsMonth) + ' h') +
      res('Output a month', qty(c.outputMonth) + ' ' + esc(m.unit)) +
      res('Earning per working hour', rs(c.marginHr), c.marginHr > 0 ? 'ok' : 'bad') +
      res('Profit per month' + (num(m.count) > 1 ? ' (all ' + m.count + ')' : ''), rs(c.fleetProfit), c.level);
    var say;
    if (c.level === 'bad') say = 'Each hour of work earns ' + rs(c.earnHr) + ' but costs ' + rs(num(m.running)) + ' to run. Running it more makes the loss bigger.';
    else if (c.level === 'warn') say = 'Needs ' + (c.breakEven <= 100 ? Math.ceil(c.breakEven) + '% utilisation' : 'more than 100% utilisation (not possible)') + ' to cover its fixed cost of ' + rs(num(m.fixed)) + ' a month.';
    else say = 'Breaks even at ' + Math.ceil(c.breakEven) + '% utilisation. Every extra working hour adds ' + rs(c.marginHr) + '.';
    $('mSay' + i).textContent = say;
  });
}
function res(l, v, cls) { return '<div class="res"><div class="l">' + l + '</div><div class="v ' + (cls || '') + '">' + v + '</div></div>'; }

/* ---------------- Drawing: spare calculator ---------------- */
function buildSpare() {
  var opts = S.machines.map(function (m) { return '<option value="' + esc(m.id) + '">' + esc(m.id + ' · ' + m.name) + '</option>'; }).join('');
  $('spareMachine').innerHTML = opts;
  $('poMachine').innerHTML = opts;
  document.querySelectorAll('[data-s]').forEach(function (el) { el.value = S.spare[el.dataset.s]; });
}
function renderSpare() {
  var r = calcSpare(), c = r.c, sp = S.spare, A = r.A, B = r.B;
  var box = $('spareVerdictBox'), lvl, head, why;
  if (c.marginHr <= 0) {
    lvl = 'bad'; head = 'No — ' + r.m.id + ' loses money every hour it runs';
    why = 'Fitting a new ' + sp.item.toLowerCase() + ' only lets it keep losing money. Look at disposal or a cheaper repair first.';
  } else if (r.paybackHrs > A.life) {
    lvl = 'bad'; head = 'No — it does not pay back within its life';
    why = 'It needs ' + int(r.paybackHrs) + ' working hours to pay back, but lasts only ' + int(A.life) + '.';
  } else {
    lvl = c.level === 'ok' ? 'ok' : 'warn';
    head = 'Yes — it pays for itself in about ' + Math.ceil(r.paybackDays) + ' days of work';
    why = 'Over its life of about ' + A.years.toFixed(1) + ' years it lets ' + r.m.id + ' move ' + qty(r.lifeOutput) + ' ' + r.m.unit +
      ', worth ' + rs(r.lifeValue) + '. The spare is ' + r.share.toFixed(1) + '% of that.' +
      (c.level === 'warn' ? ' But the machine itself does not cover its fixed cost — raise its utilisation.' : '');
  }
  box.className = 'big-verdict ' + lvl; $('spareVerdict').textContent = head; $('spareWhy').textContent = why;
  $('spareResults').innerHTML =
    res('Cost per working hour (A)', rs(A.perHr)) +
    res('Machine earns per working hour', rs(c.marginHr), c.marginHr > 0 ? 'ok' : 'bad') +
    res('Pays back after', isFinite(r.paybackHrs) ? int(r.paybackHrs) + ' h' : 'never', isFinite(r.paybackHrs) ? '' : 'bad') +
    res('Each day the machine waits for it', rs(r.dayWithout), 'bad');

  // Compare A and B
  var aWins = A.perHr <= B.perHr;
  var row = function (l, a, b) { return '<tr><th scope="row">' + l + '</th><td class="n">' + a + '</td><td class="n">' + b + '</td></tr>'; };
  $('compare').innerHTML = '<thead><tr><th></th><th class="n">' + esc(A.name) + '</th><th class="n">' + esc(B.name) + '</th></tr></thead><tbody>' +
    row('Price', rs(A.price), rs(B.price)) +
    row('Life', int(A.life) + ' h (' + A.years.toFixed(1) + ' yr)', int(B.life) + ' h (' + B.years.toFixed(1) + ' yr)') +
    row('Lead time', A.lead + ' days', B.lead + ' days') +
    '<tr class="win"><th scope="row">Cost per working hour</th><td class="n">' + rs(A.perHr) + (aWins ? ' ✓' : '') + '</td><td class="n">' + rs(B.perHr) + (aWins ? '' : ' ✓') + '</td></tr></tbody>';
  var cheap = aWins ? A : B, other = aWins ? B : A;
  var say = cheap.name + ' is cheaper per working hour by ' + rs(other.perHr - cheap.perHr) + ' — about ' + rs((other.perHr - cheap.perHr) * Math.min(A.life, B.life)) + ' over ' + int(Math.min(A.life, B.life)) + ' hours.';
  if (cheap.lead > other.lead) say += ' It takes ' + (cheap.lead - other.lead) + ' days longer to arrive, so raise the indent at least ' + cheap.lead + ' days before the old one wears out. Each day late costs ' + rs(r.dayWithout) + '.';
  $('compareSay').textContent = say;

  // Payback line
  var col = chartColors(), pts = [], steps = 40;
  for (var i = 0; i <= steps; i++) { var h = A.life * i / steps; pts.push({ x: Math.round(h), y: Math.round(h * c.marginHr - A.price) }); }
  var o = baseOpts(col);
  o.scales.x = { type: 'linear', min: 0, max: A.life, grid: { color: col.grid }, ticks: { color: col.ink, callback: function (v) { return int(v) + ' h'; } }, title: { display: true, text: 'Working hours on the spare', color: col.ink } };
  o.scales.y.ticks.callback = function (v) { return rs(v); };
  o.scales.y.grid.color = function (ctx) { return ctx.tick && ctx.tick.value === 0 ? col.ink : col.grid; };
  o.interaction = { mode: 'index', intersect: false };
  o.plugins.tooltip = { callbacks: { title: function (it) { return int(it[0].raw.x) + ' working hours'; }, label: function (ctx) { return 'Net after spare price: ' + rs(ctx.raw.y); } } };
  drawChart('spareChart', {
    type: 'line',
    data: { datasets: [{ data: pts, borderColor: col.c1, backgroundColor: col.c1, borderWidth: 2, pointRadius: 0, pointHoverRadius: 5 }] },
    options: o
  });
}

/* ---------------- Drawing: procurement ---------------- */
var poFilter = 'all', editing = -1;
function renderLinks() {
  $('links').innerHTML = S.links.map(function (l, i) {
    return '<div><p style="margin-bottom:6px">If <b>' + esc(l.from) + '</b> stops, <b>' + esc(l.to) + '</b> stops too, because ' + esc(l.why) + '.</p>' +
      '<div class="fields"><label class="f">Days of work in hand (buffer)<input type="number" min="0" data-l="' + i + '" data-k="buffer" value="' + esc(l.buffer) + '"></label>' +
      '<label class="f">How many ' + esc(l.to) + ' stop<input type="number" min="0" data-l="' + i + '" data-k="idled" value="' + esc(l.idled) + '"></label></div></div>';
  }).join('');
}
function renderOrders() {
  var oc = S.orders.map(function (o, i) { return { o: o, r: calcOrder(o), i: i }; });
  // chart: days per stage
  var col = chartColors();
  var o = baseOpts(col);
  o.indexAxis = 'y';
  o.scales.x.stacked = true; o.scales.y.stacked = true; o.scales.y.grid.display = false;
  o.scales.x.title = { display: true, text: 'Days', color: col.ink };
  o.interaction = { mode: 'index', intersect: false };
  o.plugins.tooltip = { callbacks: { label: function (ctx) { return ctx.dataset.label + ': ' + ctx.raw + ' days'; } } };
  drawChart('cycleChart', {
    type: 'bar',
    data: { labels: oc.map(function (x) { return x.o.item.length > 22 ? x.o.item.slice(0, 21) + '…' : x.o.item; }),
            datasets: [
              { label: 'Indent to purchase order', data: oc.map(function (x) { return x.r.indentToPO; }), backgroundColor: col.c1, borderColor: cssVar('--panel'), borderWidth: { right: 2 }, borderSkipped: false, maxBarThickness: 26 },
              { label: 'Purchase order to delivery', data: oc.map(function (x) { return x.r.poToDelivery; }), backgroundColor: col.c2, borderRadius: { topRight: 4, bottomRight: 4 }, borderSkipped: false, maxBarThickness: 26 }
            ] },
    options: o
  });
  var placed = oc.filter(function (x) { return x.r.poPlaced; });
  var a1 = placed.length ? placed.reduce(function (s, x) { return s + x.r.indentToPO; }, 0) / placed.length : 0;
  $('cycleSay').textContent = 'Average indent to purchase order: ' + Math.round(a1) + ' days (norm ' + INDENT_TO_PO_NORM + '). Orders not yet delivered are counted up to today.';

  var list = oc.filter(function (x) {
    if (poFilter === 'late') return x.r.idle > 0;
    if (poFilter === 'open') return !x.r.received;
    return true;
  }).sort(function (a, b) { return b.r.lost - a.r.lost || b.r.late - a.r.late; });

  $('poList').innerHTML = list.length ? list.map(function (x) {
    var o = x.o, r = x.r;
    var chain = r.chain.length ? '<div class="domino">' + r.chain.map(function (c, k) {
      return (k ? '<span class="arrow" aria-hidden="true">→</span>' : '') + '<div class="box' + (c.lost > 0 ? '' : ' zero') + '"><b>' + esc(c.id) + (c.n > 1 ? ' ×' + c.n : '') + '</b>' +
        '<small>idle ' + c.days + ' days · ' + qty(c.lostQty) + ' ' + esc(c.unit) + ' not done</small><b>' + (c.lost > 0 ? rs(c.lost) + ' lost' : 'no profit lost') + '</b></div>';
    }).join('') + '</div>' : '';
    var outcome = r.idle > 0 ? '<b>' + r.idle + ' days idle</b>, ' + rs(r.lost) + ' lost' : r.late > 0 ? '<b>' + r.late + ' days past promised date</b>, no machine stopped yet' : r.received ? 'Arrived in time' : 'Not due yet';
    return '<div class="panel po ' + r.level + '"><div class="head"><div><h3>' + esc(o.item) + '</h3><div class="meta">' + esc(o.id) + ' · for ' + esc(o.machine) + ' · ' + esc(o.supplier) + ' · ' + rs(num(o.value)) + '</div></div>' +
      '<span class="pill ' + r.level + '">' + (r.lost > 0 ? 'Cost production' : r.level === 'warn' ? 'Late' : 'On time') + '</span></div>' +
      '<div class="tags"><span class="pill plain">' + esc(o.location) + '</span><span class="pill ' + ({ High: 'bad', Medium: 'warn', Low: 'plain' }[o.urgency] || 'plain') + '">Urgency: ' + esc(o.urgency) + '</span><span class="pill plain">' + esc(o.status) + '</span></div>' +
      '<div class="steps"><div class="step"><div class="l">Indent → purchase order</div><div class="v' + (r.indentToPO > INDENT_TO_PO_NORM ? ' bad' : '') + '">' + r.indentToPO + ' days' + (r.poPlaced ? '' : ' (not placed)') + '</div></div>' +
      '<div class="step"><div class="l">Purchase order → delivery</div><div class="v">' + (r.poPlaced ? r.poToDelivery + ' days' + (r.received ? '' : ' so far') : '–') + '</div></div>' +
      '<div class="step"><div class="l">Needed by ' + fmtDate(o.required) + ' · ' + (r.received ? 'came ' + fmtDate(o.actual) : 'not yet received') + '</div><div class="v' + (r.idle > 0 ? ' bad' : '') + '">' + (r.late > 0 ? r.late + ' days late' : 'on time') + '</div></div></div>' +
      '<p style="margin:0">' + outcome + (r.chain.length > 1 ? ' — the domino:' : '') + '</p>' + chain +
      '<div class="btns"><button class="btn small" type="button" data-edit="' + x.i + '">Edit</button><button class="btn small danger" type="button" data-del="' + x.i + '">Remove</button></div></div>';
  }).join('') : '<p class="muted">No purchase orders match.</p>';
}

/* ---------------- Purchase order form ---------------- */
var FORM_KEYS = ['item', 'machine', 'location', 'supplier', 'value', 'urgency', 'status', 'indent', 'po', 'promised', 'required', 'actual', 'stopped'];
function openForm(i) {
  editing = i;
  var f = $('poForm'), o = i >= 0 ? S.orders[i] : { machine: S.machines[0].id, urgency: 'Medium', status: 'Open', stopped: 1, indent: new Date().toISOString().slice(0, 10) };
  FORM_KEYS.forEach(function (k) { f.elements[k].value = o[k] == null ? '' : o[k]; });
  $('poFormTitle').textContent = i >= 0 ? 'Edit ' + S.orders[i].id : 'Add a purchase order';
  f.hidden = false; f.elements.item.focus();
}
function saveForm(ev) {
  ev.preventDefault();
  var f = $('poForm'), o = editing >= 0 ? S.orders[editing] : {};
  FORM_KEYS.forEach(function (k) { o[k] = f.elements[k].value.trim(); });
  o.value = num(o.value); o.stopped = num(o.stopped);
  if (editing < 0) { o.id = 'PO-' + Date.now().toString().slice(-6); S.orders.push(o); }
  f.hidden = true; editing = -1;
  save(); renderAll();
}

/* ---------------- Wiring ---------------- */
function renderAll() {
  try { renderMachines(); renderSpare(); renderLinks(); renderOrders(); renderSummary(); }
  catch (e) { showError('Something went wrong while working out the figures. Please pass this message on:', e); }
}

function start() {
  S = load();
  if (!window.Chart) showError('The charts could not load (no internet, or the chart library was blocked). The figures below still work.', 'Chart.js did not load from cdn.jsdelivr.net');
  buildMachineCards(); buildSpare(); renderAll();

  document.addEventListener('input', function (e) {
    var t = e.target, d = t.dataset;
    if (d.m != null) { S.machines[+d.m][d.k] = num(t.value); save(); renderMachines(); renderSpare(); renderOrders(); renderSummary(); }
    else if (d.s != null) { S.spare[d.s] = t.type === 'number' ? num(t.value) : t.value; save(); renderSpare(); }
    else if (d.l != null) { S.links[+d.l][d.k] = num(t.value); save(); renderOrders(); renderSummary(); }
  });
  document.addEventListener('change', function (e) {
    if (e.target.id === 'spareMachine') { S.spare.machine = e.target.value; save(); renderSpare(); }
    if (e.target.id === 'poFilter') { poFilter = e.target.value; renderOrders(); }
  });
  $('poList').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.dataset.edit != null) { openForm(+b.dataset.edit); $('poForm').scrollIntoView({ block: 'start' }); }
    if (b.dataset.del != null && confirm('Remove "' + S.orders[+b.dataset.del].item + '"?')) { S.orders.splice(+b.dataset.del, 1); save(); renderAll(); }
  });
  $('addPO').addEventListener('click', function () { openForm(-1); });
  $('poCancel').addEventListener('click', function () { $('poForm').hidden = true; editing = -1; });
  $('poForm').addEventListener('submit', saveForm);
  $('reset').addEventListener('click', function () {
    if (!confirm('Put back the made-up sample figures? Your changes in this browser will be lost.')) return;
    S = clone(SAMPLE); save(); buildMachineCards(); buildSpare(); renderAll();
  });
  if (window.matchMedia) {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    if (mq.addEventListener) mq.addEventListener('change', renderAll);
  }
}

try { start(); } catch (e) { showError('The page could not start. Please pass this message on:', e); }
})();
