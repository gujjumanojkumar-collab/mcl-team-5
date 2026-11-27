-- 01-setup.sql
-- Creates the one table for the mine delay tool: one row per shift report.
-- Paste ALL of this into the Supabase SQL Editor and press Run, once.
-- All data stored here must be MADE UP (no real names or real MCL figures).

create table if not exists public.shift_reports (
  id                  uuid primary key default gen_random_uuid(),
  created_at          timestamptz not null default now(),
  report_date         date not null,
  shift               text not null check (shift in ('A','B','C','D','E','F')),
  location            text not null default '',
  holes_drilled       numeric not null default 0 check (holes_drilled >= 0),
  drill_delay_min     numeric not null default 0 check (drill_delay_min >= 0),
  drill_reason        text not null default 'None',
  holes_blasted       numeric not null default 0 check (holes_blasted >= 0),
  explosive_issued_kg numeric not null default 0 check (explosive_issued_kg >= 0),
  explosive_used_kg   numeric not null default 0 check (explosive_used_kg >= 0),
  blast_delay_min     numeric not null default 0 check (blast_delay_min >= 0),
  blast_reason        text not null default 'None',
  shovels_working     numeric not null default 0 check (shovels_working >= 0),
  tippers_working     numeric not null default 0 check (tippers_working >= 0),
  round_trip_min      numeric not null default 0 check (round_trip_min >= 0),
  bcm_moved           numeric not null default 0 check (bcm_moved >= 0),
  load_delay_min      numeric not null default 0 check (load_delay_min >= 0),
  load_reason         text not null default 'None',
  urgency             text not null default 'Low' check (urgency in ('Low','Medium','High')),
  status              text not null default 'Open' check (status in ('Open','In progress','Resolved')),
  note                text not null default '',
  -- one report per date and shift; a second save for the same shift updates it
  constraint shift_reports_one_per_shift unique (report_date, shift)
);

alter table public.shift_reports enable row level security;

-- Anyone with the website link may read, add and update reports. Nobody may delete.
drop policy if exists "Anyone can read shift reports"   on public.shift_reports;
drop policy if exists "Anyone can add shift reports"    on public.shift_reports;
drop policy if exists "Anyone can update shift reports" on public.shift_reports;

create policy "Anyone can read shift reports" on public.shift_reports
  for select to anon, authenticated using (true);
create policy "Anyone can add shift reports" on public.shift_reports
  for insert to anon, authenticated with check (true);
create policy "Anyone can update shift reports" on public.shift_reports
  for update to anon, authenticated using (true) with check (true);

grant select, insert, update on public.shift_reports to anon, authenticated;
