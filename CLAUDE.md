# CLAUDE.md - read this first, in every session

## About us
- We are a team of 4-5 people from Mahanadi Coalfields Limited (MCL) at an
  IIM Sambalpur MDP. We are NOT programmers.
- Explain everything in plain English, in short sentences. If you must use a
  technical word, explain it in one line.
- We build ONE small web tool in phases. Only one Claude session works at a
  time. The Progress Log at the end of this file is our handover logbook.

## What we are building
- A tool with at most 3 pages: index.html (entry page), dashboard.html
  (dashboard) and at most one more page.
- Every record has location, urgency (Low / Medium / High) and status
  (Open / In progress / Resolved), plus the columns in "Our tool" below.
- All data is MADE UP. Never add real names, phone numbers, employee IDs or
  real MCL figures.

## Technical rules
1. Plain HTML, CSS and JavaScript only. Pages stay in the top folder; SQL
   files go in the database folder. No frameworks, no npm, no package.json,
   no build step.
2. Vercel publishes the site from the main branch. Use relative links only,
   e.g. href="dashboard.html".
3. Load Supabase from the jsDelivr CDN, then our settings, in this order:
     <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
     <script src="config.js"></script>
   Then create the client like this (do not call the variable "supabase"):
     const db = window.supabase.createClient(window.SUPABASE_URL,
                                              window.SUPABASE_PUBLISHABLE_KEY);
4. The Project URL and the publishable key live only in config.js. Never use
   or ask for a secret key, a service_role key or the database password.
5. For charts, load Chart.js from the jsDelivr CDN.
6. No login or sign-up. Anyone with the link can use the tool.
7. You may not be able to reach our database. Do NOT try to test the database
   connection. Write the code; we test it on the live website.
8. If anything fails, show a friendly message on the page that also includes
   the actual error text, so we can pass it on.
9. Every page must work well on a mobile phone: large buttons, readable text,
   no sideways scrolling. Use the same header and menu on every page.
10. Never delete config.js or CLAUDE.md.

## Database rules
- Our Data Keeper runs all SQL by pasting it into the Supabase SQL Editor.
  You cannot run SQL yourself.
- Give SQL as ONE block that runs in one go. Also save it in the database
  folder: 01-setup.sql, then 02-..., 03-... for later changes.
- One table. It must have: id uuid primary key default gen_random_uuid()
  and created_at timestamptz not null default now().
- Enable Row Level Security. Add policies that let the roles anon and
  authenticated SELECT, INSERT and UPDATE. No delete.
- Always include: grant select, insert, update on the table to anon,
  authenticated; (new Supabase projects need it, or the website gets
  "permission denied").
- Never drop a table or delete rows.
- Avoid changing the table after Phase 1. If a change is really needed, give
  one small block and explain it in one sentence.

## How to work with us
- Make one change at a time. Do not change parts that already work unless we
  ask.
- After each change, reply in 3 short bullets: what you changed and what we
  should test on the live website.
- Commit and push your work at every stopping point.

## Takeover and handover
- At the START of every session: read the Progress Log below and summarize it
  in 3 bullets (what exists, what works, what is next).
- At a "save point": add a new entry at the end of the Progress Log (phase,
  builder, what was built, what works, known problems, next step). Then
  commit and push.

## Our tool (filled in during Phase 1)
- Team: MCL team 5
- Tool name: Mine production delay monitor
- Problem: find which contractor (drilling, blasting, loading and hauling)
  caused a production delay, where it started, and what it cost.
- Who records / who decides: shift supervisors record shift reports; the
  manager reads the dashboard and follows up with the defaulting contractor.
- Table name and columns: shift_reports (see database/01-setup.sql):
  id, created_at, report_date, shift, location, holes_drilled,
  drill_delay_min, drill_reason, holes_blasted, explosive_issued_kg,
  explosive_used_kg, blast_delay_min, blast_reason, shovels_working,
  tippers_working, round_trip_min, bcm_moved, load_delay_min, load_reason,
  urgency, status, note. One row per date and shift.
- Pages: index.html = entry page; dashboard.html = dashboard;
  summary.html = project summary for the MDP presentation

## Progress Log (newest entry at the bottom)
- Phase 0 (starter): placeholder index.html, config.js without settings and
  this CLAUDE.md. Next: Phase 1 - the table and the entry page.
- Delay dashboard (added by Claude, not a numbered phase): dashboard.html shows
  a mine production delay monitor (drilling, blasting, loading and hauling).
  It reads made-up shift data from shifts.json (made by
  tools/make_sample_data.py). No database is used. Works: charts, stage cards,
  worst-shifts table, phone layout. Known problems: index.html is still the
  placeholder and has no link to the dashboard; the numbers are made up and
  the tipper load, shovel count and Rs 150 per BCM cost are guesses. Next:
  replace shifts.json with real shift reports, or connect it to the database.
- Dashboard redesign (Claude): dashboard.html restyled (dark header, stage
  cards, tap-a-day timeline, section menu, phone-friendly shift log). Charts
  now use Chart.js from jsDelivr. Same made-up data and same calculations.
  Next: real shift data, and blame for drilling delays caused by uncleared rock.
- Inputs page (Claude): index.html is now the Inputs page. It has mine
  settings with a live "plan check", a shift-report form (with location,
  urgency, status), a list of reports with edit and remove, and CSV import and
  export (for future SAP exports). mine.js holds the shared calculations;
  style.css the shared look. dashboard.html recalculates from the inputs, by
  day: one blast a day, holes and rock checked shift by shift, and drilling
  blocked by uncleared rock is charged to loading. With no reports it shows
  made-up sample reports. Known problems: data is saved in each browser only
  (localStorage), so team members do not see each other's reports. Next: move
  the reports to the Supabase table so everyone shares them.
- Database connection (Claude): database/01-setup.sql creates shift_reports
  with RLS (read, add, update; no delete). index.html and dashboard.html load
  supabase-js and config.js, and save reports to the table when config.js is
  filled in; until then they keep reports in the browser. The dashboard
  re-reads the table every minute. Mine settings are still kept per browser
  (only one table is allowed). Not tested against the real database.
  Next: Data Keeper runs 01-setup.sql and fills in config.js, then test.
- UI refresh (Claude): dashboard opens with a verdict ("<stage> is the
  primary defaulter") and a delivery gauge; key figures; stage cards with
  buffer "tanks" (work in hand) between them; only real delay days in the
  table; a Print or save as PDF button with a print layout. Inputs page now
  has tabs (Add a shift report, Shift reports, Mine settings, Import and
  export) and the shift form is laid out stage by stage with the planned
  figure under each box. Fixed: hidden buttons showing (Cancel editing,
  Remove all, Remove in database mode) and the page jumping down on load.
  Next: real data in Supabase; decide who is responsible for each delay reason.
- Mine images (Claude): images/ folder with original drawings (no photos, no
  real MCL material): mine-scene.svg (open-cast pit with benches, coal seam,
  drill rig, shovel loading a tipper, haul road, blast, light masts) shown
  along the foot of the header on both pages; drill.svg, blast.svg, load.svg
  as stage drawings tinted with each stage colour (dashboard stage cards and
  the shift form); favicon.svg as the browser-tab icon. The scene is left out
  when printing.
- Project summary (Claude): summary.html is the third page, linked from the
  menu on every page. It covers the problem, what the tool does, how it
  decides who is at fault, live results (same calculation as the dashboard),
  how it is built, value for MCL, limits and next steps, and a 5-minute demo
  script. It prints to PDF as a handout. Next: practise the demo; run the
  database setup and fill in config.js before the presentation if possible.
- MCL PPT skill (Claude): .claude/skills/mcl-ppt/ is a Claude skill for making
  PowerPoint decks. Every slide gets the MCL logo top right (assets/mcl-logo.jpg),
  the footer "Mahanadi Coalfields Ltd" and a blue, black and white theme.
  scripts/mcl_deck.py builds the slides (title, section, bullets, two columns,
  key figures, table, chart, closing). Tested with a sample deck. Not part of
  the website. Next: ask Claude in this repo to "make a PPT on ..." to use it.
- MCL PPT plugin (Claude): the PPT skill is now also a Claude Code plugin.
  It moved to plugins/mcl-ppt/ (.claude/skills/mcl-ppt is a shortcut to it, so
  it still works in this project). .claude-plugin/marketplace.json lists it, so
  others can install it with "/plugin marketplace add
  gujjumanojkumar-collab/mcl-team-5" then "/plugin install mcl-ppt@mcl-team-5".
  Install steps in plugins/mcl-ppt/README.md. Both files pass "claude plugin
  validate". Next: once this branch is merged into main, try installing it.
