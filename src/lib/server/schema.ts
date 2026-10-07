// The whole database. Every statement is idempotent; they run once each time the server starts
// (see db.ts), so adding a table here is all it takes to create it.
export const SCHEMA: string[] = [
  `create table if not exists tasks (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    notes text,
    project text not null default 'personal',
    priority text not null default 'medium' check (priority in ('low','medium','high','urgent')),
    status text not null default 'todo' check (status in ('todo','in_progress','waiting','done')),
    deadline timestamptz,
    deadline_has_time boolean not null default false,
    estimated_minutes int,
    waiting_on text,
    link text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    completed_at timestamptz,
    deleted_at timestamptz
  )`,
  `create index if not exists tasks_open_idx on tasks (status) where deleted_at is null`,

  `create table if not exists attention_items (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    detail text,
    severity text not null default 'orange' check (severity in ('red','orange','yellow')),
    link text,
    due date,
    created_at timestamptz not null default now(),
    resolved_at timestamptz
  )`,

  // Weekly timetable. day: 1 = Monday … 7 = Sunday. week: null = every week, 'A'/'B' for rotating timetables.
  `create table if not exists timetable_slots (
    id uuid primary key default gen_random_uuid(),
    day smallint not null check (day between 1 and 7),
    week text,
    starts time not null,
    ends time not null,
    title text not null,
    kind text not null default 'class' check (kind in ('class','break','activity','other')),
    location text,
    teacher text
  )`,

  // A saved "Plan My Day" result.
  `create table if not exists day_plans (
    day date primary key,
    blocks jsonb not null,
    created_at timestamptz not null default now()
  )`,

  `create table if not exists settings (
    key text primary key,
    value jsonb not null
  )`,

  // Failed sign-ins, for per-IP lockout
  `create table if not exists login_failures (
    ip text not null,
    at timestamptz not null default now()
  )`,
  `create index if not exists login_failures_ip_idx on login_failures (ip, at)`,

  `create table if not exists documents (
    id uuid primary key default gen_random_uuid(),
    title text not null default 'Untitled',
    content text not null default '',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  )`,

  // University Business Plans: one row per idea. sections = [{id,title,content}], chat = the AI conversation.
  `create table if not exists business_plans (
    id uuid primary key default gen_random_uuid(),
    title text not null default 'Untitled plan',
    idea text not null default '',
    sections jsonb not null default '[]'::jsonb,
    chat jsonb not null default '[]'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  )`,
];
