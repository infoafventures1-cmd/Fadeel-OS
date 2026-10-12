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

  /* ---------------- academics ---------------- */

  // School subjects. The next assessment's date also puts the subject on the Exams page.
  `create table if not exists subjects (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    level text not null default 'SL',
    color text not null default '#7a5fb0',
    current_grade text not null default '',
    predicted_grade text not null default '',
    next_assessment text not null default '',
    next_assessment_date date,
    sort int not null default 0,
    created_at timestamptz not null default now()
  )`,

  // Revision topics, shared by School and Exams
  `create table if not exists subject_topics (
    id uuid primary key default gen_random_uuid(),
    subject_id uuid not null references subjects(id) on delete cascade,
    title text not null,
    status text not null default 'not_started' check (status in ('not_started','learning','needs_practice','confident','mastered')),
    created_at timestamptz not null default now()
  )`,
  `create index if not exists subject_topics_subject_idx on subject_topics (subject_id)`,

  // University applications. steps = [{id,title,done}]
  `create table if not exists uni_applications (
    id uuid primary key default gen_random_uuid(),
    university text not null,
    program text not null default '',
    code text not null default '',
    region text not null default 'Other',
    tier text not null default 'target' check (tier in ('safety','target','reach')),
    deadline date,
    steps jsonb not null default '[]'::jsonb,
    notes text not null default '',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  )`,

  /* ---------------- daily edge ---------------- */
  // Single-user app: every row belongs to the one signed-in owner, so there is no user column.

  // Discovery targets. kind: rss | search | youtube. Status columns are written by the source check and each run.
  `create table if not exists edge_sources (
    id text primary key,
    name text not null,
    kind text not null check (kind in ('rss','search','youtube')),
    url text,
    site text,
    topic text,
    source_type text not null default 'news',
    enabled boolean not null default true,
    custom boolean not null default false,
    meta jsonb not null default '{}'::jsonb,
    verified_at timestamptz,
    last_status text,
    last_error text,
    last_items int,
    checked_at timestamptz
  )`,

  // Every article or video we have retrieved. canonical_url is the dedupe key, so reruns update rather than duplicate.
  `create table if not exists edge_items (
    id uuid primary key default gen_random_uuid(),
    canonical_url text not null unique,
    url text not null,
    title text not null,
    publisher text not null default '',
    domain text not null default '',
    kind text not null default 'article',
    source_id text,
    topic text,
    source_type text not null default 'news',
    access text not null default 'headline',
    published_at timestamptz,
    event_date date,
    retrieved_at timestamptz,
    snippet text not null default '',
    content text not null default '',
    words int not null default 0,
    evergreen boolean not null default false,
    cluster text,
    score real not null default 0,
    meta jsonb not null default '{}'::jsonb,
    extras jsonb not null default '{}'::jsonb,
    saved_at timestamptz,
    read_at timestamptz,
    takeaway text not null default '',
    takeaway_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  )`,
  `create index if not exists edge_items_published_idx on edge_items (published_at desc)`,

  // One briefing per local day. Replaced only by a successful run, so a failed refresh keeps the last good one.
  `create table if not exists edge_briefings (
    day date primary key,
    job_id uuid,
    data jsonb not null,
    created_at timestamptz not null default now()
  )`,

  // Research runs. state = the checkpoint between stages, so an interrupted run resumes instead of starting over.
  `create table if not exists edge_jobs (
    id uuid primary key default gen_random_uuid(),
    kind text not null default 'daily',
    day date not null,
    trigger text not null default 'cron',
    status text not null default 'running' check (status in ('running','done','failed','skipped')),
    stage text not null default 'discover',
    state jsonb not null default '{}'::jsonb,
    log jsonb not null default '[]'::jsonb,
    attempts int not null default 1,
    error text,
    cost_usd numeric not null default 0,
    started_at timestamptz not null default now(),
    heartbeat_at timestamptz not null default now(),
    finished_at timestamptz
  )`,
  // At most one running job: the database itself refuses a second, so overlapping triggers can't both run
  `create unique index if not exists edge_jobs_one_running on edge_jobs ((true)) where status = 'running'`,

  // Spend tracking for the monthly cap
  `create table if not exists edge_usage (
    id bigserial primary key,
    at timestamptz not null default now(),
    provider text not null,
    purpose text not null,
    units int not null default 1,
    input_tokens int not null default 0,
    output_tokens int not null default 0,
    cost_usd numeric not null default 0,
    job_id uuid
  )`,

  `create table if not exists edge_feedback (
    id bigserial primary key,
    item_id uuid references edge_items(id) on delete cascade,
    topic text,
    domain text,
    signal smallint not null check (signal in (-1, 1)),
    created_at timestamptz not null default now()
  )`,

  // Spaced recall: one row per scheduled review (about 1, 7 and 30 days after learning something)
  `create table if not exists edge_reviews (
    id uuid primary key default gen_random_uuid(),
    item_id uuid references edge_items(id) on delete cascade,
    source_day date,
    title text not null,
    question text not null,
    answer text not null,
    interval_days int not null,
    due date not null,
    done_at timestamptz,
    result text check (result in ('got','missed')),
    created_at timestamptz not null default now()
  )`,
  `create unique index if not exists edge_reviews_unique on edge_reviews (title, question, interval_days) where done_at is null`,

  `create table if not exists edge_weekly (
    week_start date primary key,
    data jsonb not null,
    created_at timestamptz not null default now()
  )`,

  `create table if not exists academic_notes (
    id uuid primary key default gen_random_uuid(),
    title text not null default 'Untitled note',
    body text not null default '',
    subject_id uuid references subjects(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  )`,
];
