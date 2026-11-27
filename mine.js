// mine.js - shared by index.html (Inputs) and dashboard.html.
// Holds the mine settings, the saved shift reports, the plan checks,
// the made-up sample generator and the delay calculations.
// Everything is saved in this browser only (localStorage) until the
// Supabase database is set up.
var Mine = (function () {
  var KEY_SETTINGS = 'mine.settings.v1', KEY_ENTRIES = 'mine.entries.v1';

  var DEFAULTS = {
    target_bcm_day: 30000, shifts_per_day: 3, shift_hours: 8, shift_start: '06:00',
    holes_plan_day: 1200, explosive_plan_kg_day: 60000, powder_factor: 2,
    blast_time: '15:00', blast_hours: 1,
    shovels_total: 18, bucket_m3: 2.5, bucket_fill: 0.9, bucket_cycle_s: 30,
    tippers_total: 90, tipper_m3: 30, round_trip_min: 5,
    swell: 1.3, efficiency: 0.85, cost_per_bcm: 150,
    holes_open: 800, rock_open_bcm: 30000
  };

  // [key, label, unit, group, step, help]
  var SETTINGS_FIELDS = [
    ['target_bcm_day', 'Production target', 'BCM a day', 'Plan', 100, 'BCM = cubic metres of rock measured in the ground.'],
    ['shifts_per_day', 'Shifts a day', 'shifts', 'Plan', 1, ''],
    ['shift_hours', 'Shift length', 'hours', 'Plan', 0.5, ''],
    ['shift_start', 'First shift starts at', 'time', 'Plan', null, 'Shift A starts at this time.'],
    ['holes_plan_day', 'Holes to drill', 'holes a day', 'Drilling and blasting', 10, ''],
    ['explosive_plan_kg_day', 'Explosive planned', 'kg a day', 'Drilling and blasting', 100, ''],
    ['powder_factor', 'Powder factor', 'm³ of rock per kg', 'Drilling and blasting', 0.05, 'How much rock 1 kg of explosive breaks.'],
    ['blast_time', 'Blast time', 'time', 'Drilling and blasting', null, 'One blast a day.'],
    ['blast_hours', 'Blast and clearance takes', 'hours', 'Drilling and blasting', 0.25, ''],
    ['shovels_total', 'Shovels', 'in total', 'Loading and hauling', 1, ''],
    ['bucket_m3', 'Shovel bucket size', 'm³', 'Loading and hauling', 0.1, ''],
    ['bucket_cycle_s', 'One bucket pass takes', 'seconds', 'Loading and hauling', 1, 'Dig, swing, dump, swing back.'],
    ['tippers_total', 'Tippers', 'in total', 'Loading and hauling', 1, ''],
    ['tipper_m3', 'Tipper capacity', 'm³', 'Loading and hauling', 1, ''],
    ['round_trip_min', 'Tipper round trip', 'minutes', 'Loading and hauling', 1, 'Load, travel to the dump, tip, and come back.'],
    ['cost_per_bcm', 'Cost of lost output', '₹ per BCM', 'Money', 10, 'Use your penalty rate or profit per BCM.'],
    ['bucket_fill', 'Bucket fill factor', '0 to 1', 'Advanced', 0.05, 'How full each bucket really is.'],
    ['swell', 'Swell factor', 'times', 'Advanced', 0.05, 'Blasted rock takes more space than rock in the ground.'],
    ['efficiency', 'Working efficiency', '0 to 1', 'Advanced', 0.05, 'Share of shift time actually worked.'],
    ['holes_open', 'Drilled holes in hand at start', 'holes', 'Advanced', 10, 'Holes drilled but not yet blasted on day 1.'],
    ['rock_open_bcm', 'Blasted rock in hand at start', 'BCM', 'Advanced', 100, 'Rock blasted but not yet loaded on day 1.']
  ];

  var REASONS = {
    drill: ['None', 'Rig breakdown', 'Drill bit shortage', 'Operator shortage', 'Rain / weather', 'Blocked: blasted rock not cleared', 'Power failure', 'Other'],
    blast: ['None', 'Explosive delivery delay', 'Safety clearance / permit', 'Rain / lightning hold', 'Misfire re-work', 'Not enough drilled holes', 'Other'],
    load: ['None', 'Shovel breakdown', 'Tipper shortage', 'Haul road wet / blocked', 'Dump yard congestion', 'Operator shortage', 'Power failure', 'Other']
  };
  var BLOCKED = 'Blocked: blasted rock not cleared';

  // [key, label, type, group]
  var ENTRY_FIELDS = [
    ['date', 'Date', 'date', 'Shift'], ['shift', 'Shift', 'shift', 'Shift'], ['location', 'Location', 'text', 'Shift'],
    ['holes_drilled', 'Holes drilled', 'number', 'Drilling'], ['drill_delay_min', 'Drilling time lost (min)', 'number', 'Drilling'], ['drill_reason', 'Reason', 'drill', 'Drilling'],
    ['holes_blasted', 'Holes blasted', 'number', 'Blasting'], ['explosive_issued_kg', 'Explosive issued (kg)', 'number', 'Blasting'], ['explosive_used_kg', 'Explosive used (kg)', 'number', 'Blasting'], ['blast_delay_min', 'Blast delay (min)', 'number', 'Blasting'], ['blast_reason', 'Reason', 'blast', 'Blasting'],
    ['shovels_working', 'Shovels working', 'number', 'Loading and hauling'], ['tippers_working', 'Tippers working', 'number', 'Loading and hauling'], ['round_trip_min', 'Average round trip (min)', 'number', 'Loading and hauling'], ['bcm_moved', 'Rock moved (BCM)', 'number', 'Loading and hauling'], ['load_delay_min', 'Loading time lost (min)', 'number', 'Loading and hauling'], ['load_reason', 'Reason', 'load', 'Loading and hauling'],
    ['urgency', 'Urgency', 'urgency', 'Follow-up'], ['status', 'Status', 'status', 'Follow-up'], ['note', 'Note', 'text', 'Follow-up']
  ];
  var NUM_KEYS = ENTRY_FIELDS.filter(function (f) { return f[2] === 'number'; }).map(function (f) { return f[0]; });
  var STAGES = ['Drilling', 'Blasting', 'Loading & hauling'];
  var CONTRACTORS = ['Contractor A', 'Contractor B', 'Contractor C'];

  /* ---------- storage ---------- */
  function read(key, fallback) { try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; } }
  function write(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch (e) { return false; } }
  function loadSettings() { var s = read(KEY_SETTINGS, {}), out = {}; for (var k in DEFAULTS) out[k] = (s[k] !== undefined && s[k] !== null && s[k] !== '') ? s[k] : DEFAULTS[k]; return out; }
  function saveSettings(s) { return write(KEY_SETTINGS, s); }
  function loadEntries() { var e = read(KEY_ENTRIES, []); return Array.isArray(e) ? e : []; }
  function saveEntries(e) { return write(KEY_ENTRIES, e); }

  /* ---------- helpers ---------- */
  function toMin(t) { var p = String(t || '0:0').split(':'); return (+p[0] || 0) * 60 + (+p[1] || 0); }
  function num(v) { var n = parseFloat(v); return isFinite(n) ? n : 0; }
  function sum(a, f) { return a.reduce(function (s, r) { return s + f(r); }, 0); }
  function N(v) { return Math.round(v).toLocaleString('en-IN'); }
  function newId() { return 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  /* ---------- plan numbers and checks ---------- */
  function derive(s) {
    var d = {};
    d.bcm_per_hole = s.target_bcm_day / s.holes_plan_day;
    d.explosive_needed_kg = s.target_bcm_day / s.powder_factor;
    d.kg_per_hole = s.explosive_plan_kg_day / s.holes_plan_day;
    d.shift_min = s.shift_hours * 60;
    d.day_min = s.shifts_per_day * d.shift_min;
    d.avail_min_day = d.day_min * s.efficiency;
    d.passes = Math.ceil(s.tipper_m3 / (s.bucket_m3 * s.bucket_fill));
    d.load_min = d.passes * s.bucket_cycle_s / 60;
    d.trip_min = Math.max(s.round_trip_min, d.load_min);
    d.loads_needed = s.target_bcm_day * s.swell / s.tipper_m3;
    d.shovel_loads = s.shovels_total * d.avail_min_day / d.load_min;
    d.haul_loads = s.tippers_total * d.avail_min_day / d.trip_min;
    d.cap_bcm_day = Math.min(d.shovel_loads, d.haul_loads) * s.tipper_m3 / s.swell;
    d.tippers_per_shovel = s.tippers_total / s.shovels_total;
    d.ideal_tippers_per_shovel = d.trip_min / d.load_min;
    var bs = ((toMin(s.blast_time) - toMin(s.shift_start)) % 1440 + 1440) % 1440;
    d.blast_start = bs; d.blast_end = bs + s.blast_hours * 60;
    d.blast_shift = Math.min(s.shifts_per_day - 1, Math.floor(bs / d.shift_min));
    return d;
  }

  function checks(s) {
    var d = derive(s), out = [];
    var expTxt = 'At ' + s.powder_factor + ' m³ per kg, ' + N(s.target_bcm_day) + ' BCM needs ' + N(d.explosive_needed_kg / 1000) + ' t of explosive a day';
    if (Math.abs(s.explosive_plan_kg_day - d.explosive_needed_kg) / d.explosive_needed_kg > 0.1)
      out.push({ level: 'warn', text: expTxt + ', but the plan says ' + N(s.explosive_plan_kg_day / 1000) + ' t. Check the powder factor or the explosive plan.' });
    else out.push({ level: 'ok', text: expTxt + '. This matches the explosive plan.' });
    out.push({ level: 'ok', text: 'Each hole must break ' + d.bcm_per_hole.toFixed(1) + ' BCM, using ' + d.kg_per_hole.toFixed(1) + ' kg of explosive.' });
    if (s.round_trip_min < d.load_min)
      out.push({ level: 'bad', text: 'A ' + s.round_trip_min + ' minute round trip is shorter than the ' + d.load_min.toFixed(1) + ' minutes a shovel needs to fill one tipper (' + d.passes + ' bucket passes). Enter the full round trip: loading, travel, tipping and return. Until then the dashboard uses ' + d.load_min.toFixed(1) + ' minutes.' });
    if (d.cap_bcm_day < s.target_bcm_day)
      out.push({ level: 'bad', text: 'With all machines working, loading can move only ' + N(d.cap_bcm_day) + ' BCM a day, below the target of ' + N(s.target_bcm_day) + '.' });
    else out.push({ level: 'ok', text: 'With all machines working, loading can move about ' + N(d.cap_bcm_day) + ' BCM a day (' + Math.round(d.cap_bcm_day / s.target_bcm_day * 100) + '% of target). That needs ' + N(d.loads_needed) + ' tipper loads a day.' });
    var tp = d.tippers_per_shovel, ideal = d.ideal_tippers_per_shovel;
    if (tp > ideal + 1) out.push({ level: 'warn', text: N(tp) + ' tippers per shovel, but about ' + Math.max(1, Math.round(ideal)) + ' keep a shovel busy. Extra tippers will queue at the shovels.' });
    else if (tp < ideal - 1) out.push({ level: 'warn', text: 'Only ' + tp.toFixed(1) + ' tippers per shovel, but about ' + Math.round(ideal) + ' are needed. Shovels will stand waiting for tippers.' });
    return out;
  }

  /* ---------- made-up sample reports ---------- */
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function sample(s, days) {
    days = days || 30;
    var d = derive(s), R = rng(42), g = function (m, sd) { return m + sd * (R() + R() + R() - 1.5) * 1.15; };
    var perHoles = s.holes_plan_day / s.shifts_per_day, perBcm = s.target_bcm_day / s.shifts_per_day;
    var holes = s.holes_open, rock = s.rock_open_bcm, out = [];
    var end = new Date(); end.setDate(end.getDate() - 1);
    var locs = ['East pit, Bench 2', 'East pit, Bench 3', 'West pit, Bench 1'];
    for (var day = 0; day < days; day++) {
      var dt = new Date(end); dt.setDate(end.getDate() - (days - 1 - day));
      var date = dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
      for (var k = 0; k < s.shifts_per_day; k++) {
        var e = { id: 's' + day + '_' + k, date: date, shift: 'ABCDEF'[k], location: locs[(day + k) % 3] };
        // drilling
        var a = Math.min(1.03, g(0.99, 0.025)), dr = 'None';
        if (day === 4 || day === 5) { a = 0.4; dr = 'Rig breakdown'; }
        if (day === 11) { a = 0.7; dr = 'Rain / weather'; }
        if (day === 23 || day === 24) { a = 1000 / 1200; dr = BLOCKED; }
        if (dr === 'None' && a < 0.95) dr = 'Operator shortage';
        e.holes_drilled = Math.round(perHoles * a);
        e.drill_delay_min = dr === 'None' ? 0 : Math.round(d.shift_min * (1 - Math.min(a, 1)));
        e.drill_reason = dr;
        // blasting: one blast a day, in the shift that holds the blast time
        e.holes_blasted = 0; e.explosive_issued_kg = 0; e.explosive_used_kg = 0; e.blast_delay_min = 0; e.blast_reason = 'None';
        if (k === d.blast_shift) {
          var avail = holes + e.holes_drilled;
          var issued = s.explosive_plan_kg_day * g(0.93, 0.02), br = 'None', frac = Math.min(1, g(0.995, 0.01));
          if (day === 11) { frac = 0.65; br = 'Rain / lightning hold'; e.blast_delay_min = 120; }
          if (day === 15 || day === 16) { issued = d.explosive_needed_kg * 0.55; br = 'Explosive delivery delay'; e.blast_delay_min = 90; }
          var capHoles = Math.floor(issued * s.powder_factor / d.bcm_per_hole);
          var b = Math.max(0, Math.min(Math.round(avail), Math.round(s.holes_plan_day * frac), capHoles));
          if (b < s.holes_plan_day * 0.95 && br === 'None' && avail < s.holes_plan_day) br = 'Not enough drilled holes';
          e.holes_blasted = b; e.explosive_issued_kg = Math.round(issued / 100) * 100;
          e.explosive_used_kg = Math.round(Math.min(issued, b * d.kg_per_hole * g(0.98, 0.01)) / 100) * 100;
          e.blast_reason = br;
        }
        // loading
        var sh = s.shovels_total - (R() < 0.3 ? 1 : 0), tp = s.tippers_total - Math.floor(R() * 4), rt = d.trip_min * g(1.03, 0.03), ld = Math.max(0, Math.round(g(10, 8))), lr = 'None';
        if (day === 11) { ld = 150; lr = 'Haul road wet / blocked'; rt = d.trip_min * 1.4; }
        if (day >= 21 && day <= 23) { sh = s.shovels_total - 5; ld = 300; lr = 'Shovel breakdown'; }
        if (lr === 'None' && ld >= 30) lr = 'Dump yard congestion';
        var availMin = Math.max(0, d.shift_min - ld) * s.efficiency;
        var cap = Math.min(sh * availMin / d.load_min, tp * availMin / Math.max(rt, d.load_min)) * s.tipper_m3 / s.swell;
        var moved = Math.max(0, Math.min(cap, rock, perBcm * g(1.0, 0.02)));
        e.shovels_working = sh; e.tippers_working = tp; e.round_trip_min = Math.round(rt * 10) / 10;
        e.bcm_moved = Math.round(moved); e.load_delay_min = ld; e.load_reason = lr;
        rock -= e.bcm_moved;
        holes += e.holes_drilled - e.holes_blasted;
        if (k === d.blast_shift) rock += e.holes_blasted * d.bcm_per_hole;
        var worst = Math.max(e.drill_delay_min, e.blast_delay_min, e.load_delay_min);
        e.urgency = worst >= 120 ? 'High' : worst >= 30 ? 'Medium' : 'Low';
        e.status = day < days - 3 ? 'Resolved' : (worst >= 30 ? 'In progress' : 'Resolved');
        e.note = '';
        out.push(e);
      }
    }
    return out;
  }

  /* ---------- delay calculations (by day) ---------- */
  function topReason(rs, delayKey, reasonKey) {
    var by = {};
    rs.forEach(function (r) { var x = r[reasonKey]; if (x && x !== 'None') by[x] = (by[x] || 0) + num(r[delayKey]) + 1; });
    var k = Object.keys(by).sort(function (a, b) { return by[b] - by[a]; });
    return k[0] || '';
  }
  function corr(x, y) { var n = x.length; if (n < 3) return 0; var mx = sum(x, function (v) { return v; }) / n, my = sum(y, function (v) { return v; }) / n, a = 0, b = 0, c = 0; for (var i = 0; i < n; i++) { a += (x[i] - mx) * (y[i] - my); b += Math.pow(x[i] - mx, 2); c += Math.pow(y[i] - my, 2); } return b && c ? a / Math.sqrt(b * c) : 0; }

  function compute(s, entries) {
    var d = derive(s), T = s.target_bcm_day, PH = s.holes_plan_day, bph = d.bcm_per_hole, TOL = 0.05;
    var byDate = {};
    entries.forEach(function (e) { if (e.date) (byDate[e.date] = byDate[e.date] || []).push(e); });
    var holes = s.holes_open, rock = s.rock_open_bcm, days = [];
    Object.keys(byDate).sort().forEach(function (date) {
      var rs = byDate[date], f = function (k) { return sum(rs, function (r) { return num(r[k]); }); };
      var x = { date: date, shifts: rs.length, holes_start: holes, rock_start: rock };
      x.drilled = f('holes_drilled'); x.blasted = f('holes_blasted'); x.moved = f('bcm_moved');
      x.issued = f('explosive_issued_kg'); x.used = f('explosive_used_kg');
      x.drill_delay = f('drill_delay_min'); x.blast_delay = f('blast_delay_min'); x.load_delay = f('load_delay_min');
      x.shovels = f('shovels_working') / rs.length; x.tippers = f('tippers_working') / rs.length; x.round_trip = f('round_trip_min') / rs.length;
      x.drill_reason = topReason(rs, 'drill_delay_min', 'drill_reason');
      x.blast_reason = topReason(rs, 'blast_delay_min', 'blast_reason');
      x.load_reason = topReason(rs, 'load_delay_min', 'load_reason');
      // Plans for the shifts actually reported (a day with 1 of 3 shifts gets 1/3 of the plan).
      var frac = Math.min(1, rs.length / s.shifts_per_day), Td = T * frac, PHd = PH * frac;
      var blastDue = rs.some(function (r) { return r.shift === 'ABCDEF'[d.blast_shift]; }) || x.blasted > 0, PB = blastDue ? PH : 0;
      x.plan = Td; x.plan_holes = PHd; x.plan_blast = PB;
      // Drilling
      var drillShort = Math.max(0, PHd - x.drilled) * bph;
      x.blocked = x.drill_reason === BLOCKED ? drillShort : 0;
      x.drill_own = drillShort - x.blocked;
      // Blasting: only holes drilled before the blast can be blasted that day.
      var sorted = rs.slice().sort(function (a, b) { return String(a.shift).localeCompare(String(b.shift)); });
      var holesS = holes, holesAvail = null;
      sorted.forEach(function (r) {
        holesS += num(r.holes_drilled);
        var b = num(r.holes_blasted);
        if (b > 0) { holesAvail = Math.max(holesAvail || 0, holesS); holesS = Math.max(0, holesS - b); }
      });
      if (holesAvail === null) holesAvail = holesS;
      var blastShort = Math.max(0, PB - x.blasted);
      var starvedHoles = Math.min(blastShort, Math.max(0, PB - holesAvail));
      x.blast_starved = starvedHoles * bph; x.blast_own = (blastShort - starvedHoles) * bph;
      if (x.blast_own > 0 && !x.blast_reason) x.blast_reason = (x.issued * s.powder_factor < (PB - starvedHoles) * bph) ? 'Explosive short of need' : 'Not recorded';
      if (x.blast_starved > 0 && x.blast_own <= 0) x.blast_reason = x.blast_reason || 'Not enough drilled holes';
      // Loading and hauling
      // Rock is checked shift by shift: a shift can only load rock blasted before it.
      var loadShort = Math.max(0, Td - x.moved), sp = T / s.shifts_per_day, rockS = rock, starved = 0;
      sorted.forEach(function (r) {
        var mv = num(r.bcm_moved), sh = Math.max(0, sp - mv);
        starved += Math.min(sh, Math.max(0, sp - rockS));
        rockS = Math.max(0, rockS - mv) + num(r.holes_blasted) * bph;
      });
      x.load_starved = Math.min(loadShort, starved);
      x.load_own = loadShort - x.load_starved;
      var cap = Math.min(x.shovels * Math.max(0, d.day_min - x.load_delay / Math.max(1, rs.length) * s.shifts_per_day) * s.efficiency / d.load_min,
        x.tippers * Math.max(0, d.day_min - x.load_delay / Math.max(1, rs.length) * s.shifts_per_day) * s.efficiency / Math.max(x.round_trip || d.trip_min, d.load_min)) * s.tipper_m3 / s.swell;
      x.capacity = cap;
      if (x.load_own > 0 && !x.load_reason) x.load_reason = cap * frac < Td ? 'Too few shovels or tippers working' : 'Not recorded';
      // stocks for the next day
      holes = holesS;
      rock = rockS;
      // outcome of the day
      x.gap = loadShort; x.loss = x.gap * s.cost_per_bcm;
      var own = [x.drill_own, x.blast_own, x.load_own + x.blocked];
      var m = own.indexOf(Math.max.apply(null, own));
      x.pct = [x.drilled / PHd * 100, PB ? x.blasted / PB * 100 : null, x.moved / Td * 100];
      x.started = ''; x.cause = '';
      if (own[m] >= Td * TOL) {
        x.started = STAGES[m];
        x.cause = m === 0 ? x.drill_reason || 'Not recorded' : m === 1 ? x.blast_reason : (x.load_own >= x.blocked ? x.load_reason : 'Rock not cleared, drilling blocked');
      }
      x.stage = x.gap >= Td * TOL ? (x.started || 'Starved by upstream') : (x.started || 'On plan');
      if (x.stage === 'Starved by upstream') x.cause = 'Not enough blasted rock';
      x.hole_cover = x.holes_start / PH; x.rock_cover = x.rock_start / T;
      days.push(x);
    });
    var n = days.length, planTotal = sum(days, function (x) { return x.plan; }), actual = sum(days, function (x) { return x.moved; });
    var stages = STAGES.map(function (st, i) {
      var key = ['drill_own', 'blast_own', 'load_own'][i];
      var own = sum(days, function (x) { return x[key] + (i === 2 ? x.blocked : 0); });
      var starved = i === 0 ? 0 : sum(days, function (x) { return x[i === 1 ? 'blast_starved' : 'load_starved']; });
      var by = {};
      days.forEach(function (x) {
        if (x[key] > 0) { var r = [x.drill_reason, x.blast_reason, x.load_reason][i] || 'Not recorded'; by[r] = (by[r] || 0) + x[key]; }
        if (i === 2 && x.blocked > 0) by['Rock not cleared, drilling blocked'] = (by['Rock not cleared, drilling blocked'] || 0) + x.blocked;
      });
      var top = Object.keys(by).sort(function (a, b) { return by[b] - by[a]; })[0];
      var pl = [sum(days, function (x) { return x.plan_holes; }), sum(days, function (x) { return x.plan_blast; }), planTotal][i];
      var done = pl ? [sum(days, function (x) { return x.drilled; }), sum(days, function (x) { return x.blasted; }), actual][i] / pl * 100 : 0;
      return { stage: st, contractor: CONTRACTORS[i], own: own, starved: starved, blocked: i === 2 ? sum(days, function (x) { return x.blocked; }) : 0,
        ownPct: planTotal ? own / planTotal * 100 : 0, starvedPct: planTotal ? starved / planTotal * 100 : 0, done: done || 0,
        bad: days.filter(function (x) { return x[key] + (i === 2 ? x.blocked : 0) >= x.plan * TOL; }).length, top: top || 'None', topLoss: top ? by[top] : 0, by: by };
    });
    var mx = Math.max.apply(null, stages.map(function (s) { return s.own; }));
    stages.forEach(function (st) { st.status = st.ownPct >= 2 ? (st.own === mx ? 'Primary defaulter' : 'Contributing') : (st.starvedPct >= 2 ? 'Starved by upstream' : 'On plan'); });
    var causes = [];
    stages.forEach(function (st, i) { for (var r in st.by) causes.push({ si: i, cause: r, loss: st.by[r] }); });
    causes.sort(function (a, b) { return b.loss - a.loss; }); causes = causes.filter(function (c) { return c.loss > 0; }).slice(0, 8);
    var dv = [[0, 'Drilling time lost', 'minutes a day', 'drill_delay', 'drill_own'], [1, 'Explosive issued', 'kg a day', 'issued', 'blast_own'], [1, 'Blast delay', 'minutes a day', 'blast_delay', 'blast_own'],
      [2, 'Loading time lost', 'minutes a day', 'load_delay', 'load_own'], [2, 'Shovels working', 'average', 'shovels', 'load_own'], [2, 'Tippers working', 'average', 'tippers', 'load_own'], [2, 'Tipper round trip', 'minutes', 'round_trip', 'load_own']];
    var drivers = n >= 5 ? dv.map(function (v) { return { si: v[0], name: v[1], unit: v[2], r: corr(days.map(function (x) { return x[v[3]]; }), days.map(function (x) { return x[v[4]]; })) }; })
      .filter(function (v) { return isFinite(v.r) && v.r !== 0; }).sort(function (a, b) { return Math.abs(b.r) - Math.abs(a.r); }) : [];
    return { settings: s, derived: d, days: days, stages: stages, causes: causes, drivers: drivers, planTotal: planTotal, actual: actual, gap: Math.max(0, planTotal - actual) };
  }

  /* ---------- CSV ---------- */
  var CSV_KEYS = ENTRY_FIELDS.map(function (f) { return f[0]; });
  function toCSV(entries) {
    var q = function (v) { v = v == null ? '' : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    return [CSV_KEYS.join(',')].concat(entries.map(function (e) { return CSV_KEYS.map(function (k) { return q(e[k]); }).join(','); })).join('\n');
  }
  function parseCSV(text) {
    var rows = [], row = [], cur = '', inQ = false;
    text = String(text).replace(/^﻿/, '');
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (inQ) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else inQ = false; } else cur += c; }
      else if (c === '"') inQ = true;
      else if (c === ',') { row.push(cur); cur = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; }
      else cur += c;
    }
    if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
    rows = rows.filter(function (r) { return r.some(function (v) { return v.trim() !== ''; }); });
    if (!rows.length) throw new Error('The file is empty.');
    var head = rows[0].map(function (h) { return h.trim().toLowerCase(); });
    if (head.indexOf('date') < 0 || head.indexOf('shift') < 0) throw new Error('The first row must hold column names, including "date" and "shift". Download the template to see the layout.');
    var out = [], bad = 0;
    rows.slice(1).forEach(function (r) {
      var e = { id: newId() };
      head.forEach(function (h, j) { if (CSV_KEYS.indexOf(h) >= 0) e[h] = (r[j] || '').trim(); });
      if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date || '') || !e.shift) { bad++; return; }
      NUM_KEYS.forEach(function (k) { e[k] = num(e[k]); });
      ['drill_reason', 'blast_reason', 'load_reason'].forEach(function (k) { if (!e[k]) e[k] = 'None'; });
      e.urgency = ['Low', 'Medium', 'High'].indexOf(e.urgency) >= 0 ? e.urgency : 'Low';
      e.status = ['Open', 'In progress', 'Resolved'].indexOf(e.status) >= 0 ? e.status : 'Open';
      out.push(e);
    });
    return { entries: out, skipped: bad };
  }

  return { DEFAULTS: DEFAULTS, SETTINGS_FIELDS: SETTINGS_FIELDS, ENTRY_FIELDS: ENTRY_FIELDS, REASONS: REASONS, STAGES: STAGES, NUM_KEYS: NUM_KEYS,
    loadSettings: loadSettings, saveSettings: saveSettings, loadEntries: loadEntries, saveEntries: saveEntries,
    derive: derive, checks: checks, sample: sample, compute: compute, toCSV: toCSV, parseCSV: parseCSV, newId: newId, N: N, num: num };
})();
