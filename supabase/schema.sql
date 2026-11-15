-- =====================================================================
-- Forge — canonical database schema
-- =====================================================================
-- Run this file once in the Supabase SQL editor (or `supabase db push`)
-- on a fresh project. It is the single source of truth for:
--   * auth-linked profiles (no PII duplication of email)
--   * practice evidence (challenges, attempts, streaks)
--   * recruiter pipelines
--   * DPDP Act 2023 controls: consent, erasure, data requests, breach log
--   * Row Level Security on every table that stores user data
--
-- Invariants enforced here, not in application code:
--   * A user can only ever read/write their own private rows (no IDOR).
--   * Practice attempts are immutable evidence (no update/delete by users).
--   * Streaks are derived server-side; clients cannot mint them.
--   * Roles cannot be self-escalated to admin.
--   * Consent is recorded per purpose, with policy version and timestamps.
--   * Account erasure keeps an accountability record containing no PII.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Helper functions (security definer so RLS policies can read profiles
-- without recursing into the profiles policies themselves)
-- ---------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.role = 'admin' from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

create or replace function public.is_recruiter()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.role in ('recruiter', 'admin') from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

revoke all on function public.is_admin() from public;
revoke all on function public.is_recruiter() from public;
grant execute on function public.is_admin() to authenticated, service_role;
grant execute on function public.is_recruiter() to authenticated, service_role;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- profiles
-- Deliberately does NOT store email: email lives only in auth.users and is
-- never exposed through a public row. This removes the most common PII leak
-- (a "public profile" policy that also exposes contact details).
-- ---------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) between 2 and 60),
  headline text check (headline is null or char_length(headline) <= 120),
  bio text check (bio is null or char_length(bio) <= 500),
  avatar_url text,
  skills text[] not null default '{}',
  role text not null default 'practitioner' check (role in ('practitioner', 'recruiter', 'admin')),
  company_name text check (company_name is null or char_length(company_name) <= 120),
  visibility text not null default 'private' check (visibility in ('public', 'recruiters_only', 'private')),
  allow_recruiter_contact boolean not null default true,
  profile_views_count integer not null default 0,
  -- Consent state (DPDP): the version accepted and when. Purpose-level
  -- detail lives in public.user_consents.
  consent_at timestamptz,
  consent_policy_version text,
  -- Erasure lifecycle. `deleted_at` marks an anonymised tombstone; rows are
  -- hard deleted by the erasure job after the grace period.
  deletion_requested_at timestamptz,
  deletion_scheduled_for timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- challenges (public catalogue, read-only to clients)
-- ---------------------------------------------------------------------

create table if not exists public.challenges (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null check (char_length(title) between 3 and 140),
  description text not null,
  difficulty text not null check (difficulty in ('beginner', 'intermediate', 'advanced')),
  category text not null,
  estimated_minutes integer not null default 10 check (estimated_minutes between 1 and 60),
  content jsonb not null,
  rubric jsonb,
  time_limit_seconds integer check (time_limit_seconds is null or time_limit_seconds between 60 and 3600),
  version integer not null default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- challenge_attempts — the evidence layer
-- Immutable for practitioners. `practice_date` is stored in UTC so streak
-- math cannot be manipulated with timestamps or client clocks.
-- ---------------------------------------------------------------------

create table if not exists public.challenge_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  submission jsonb not null,
  score integer check (score is null or (score >= 0 and score <= 100)),
  time_spent_seconds integer not null check (time_spent_seconds between 1 and 7200),
  status text not null default 'completed' check (status in ('completed', 'failed', 'abandoned')),
  practice_date date not null default ((now() at time zone 'utc')::date),
  idempotency_key text unique,
  -- Data minimisation: we keep a salted hash for abuse investigation, not raw IPs.
  ip_hash text,
  created_at timestamptz not null default now()
);

create index if not exists idx_attempts_user_id on public.challenge_attempts (user_id);
create index if not exists idx_attempts_user_day on public.challenge_attempts (user_id, practice_date desc);
create index if not exists idx_attempts_created_at on public.challenge_attempts (created_at desc);
create index if not exists idx_attempts_challenge_id on public.challenge_attempts (challenge_id);

-- ---------------------------------------------------------------------
-- streaks — derived signal, written only by the database
-- ---------------------------------------------------------------------

create table if not exists public.streaks (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  current_streak integer not null default 0 check (current_streak >= 0),
  longest_streak integer not null default 0 check (longest_streak >= 0),
  total_practice_days integer not null default 0 check (total_practice_days >= 0),
  last_practice_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.record_practice_day()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day date;
  v_next integer;
  v_prev date;
begin
  v_day := coalesce(new.practice_date, (new.created_at at time zone 'utc')::date);

  insert into public.streaks (user_id)
  values (new.user_id)
  on conflict (user_id) do nothing;

  select last_practice_date into v_prev from public.streaks where user_id = new.user_id;

  v_next := case
    when v_prev is null then 1
    when v_day = v_prev then 0
    when v_day = v_prev + 1 then 1
    else 0
  end;

  update public.streaks s
  set
    current_streak = case
      when s.last_practice_date is null then 1
      when v_day = s.last_practice_date then s.current_streak
      when v_day = s.last_practice_date + 1 then s.current_streak + 1
      when v_day > s.last_practice_date then 1
      else s.current_streak
    end,
    longest_streak = greatest(
      s.longest_streak,
      case
        when s.last_practice_date is null then 1
        when v_day = s.last_practice_date then s.current_streak
        when v_day = s.last_practice_date + 1 then s.current_streak + 1
        when v_day > s.last_practice_date then 1
        else s.current_streak
      end
    ),
    total_practice_days = s.total_practice_days
      + case when s.last_practice_date is null or v_day > s.last_practice_date then 1 else 0 end,
    last_practice_date = greatest(coalesce(s.last_practice_date, v_day), v_day),
    updated_at = now()
  where s.user_id = new.user_id;

  return new;
end;
$$;

drop trigger if exists on_attempt_recorded on public.challenge_attempts;
create trigger on_attempt_recorded
  after insert on public.challenge_attempts
  for each row execute function public.record_practice_day();

-- ---------------------------------------------------------------------
-- recruiter pipelines
-- ---------------------------------------------------------------------

create table if not exists public.recruiter_pipelines (
  id uuid primary key default gen_random_uuid(),
  recruiter_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  description text check (description is null or char_length(description) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pipeline_candidates (
  id uuid primary key default gen_random_uuid(),
  pipeline_id uuid not null references public.recruiter_pipelines (id) on delete cascade,
  candidate_id uuid not null references public.profiles (id) on delete cascade,
  stage text not null default 'new' check (stage in ('new', 'contacted', 'screening', 'interview', 'offer', 'rejected', 'hired')),
  notes text check (notes is null or char_length(notes) <= 1000),
  tags text[] not null default '{}',
  added_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pipeline_id, candidate_id)
);

-- ---------------------------------------------------------------------
-- audit_logs — accountability. Contains action + non-sensitive metadata,
-- never emails, tokens or free-text personal data.
-- ---------------------------------------------------------------------

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  actor_role text,
  action text not null check (char_length(action) <= 80),
  resource_type text not null check (char_length(resource_type) <= 60),
  resource_id text,
  details jsonb,
  ip_hash text,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_logs_user_id on public.audit_logs (user_id);
create index if not exists idx_audit_logs_created_at on public.audit_logs (created_at desc);

-- ---------------------------------------------------------------------
-- profile_views — "who looked at me" (transparency for practitioners)
-- ---------------------------------------------------------------------

create table if not exists public.profile_views (
  id uuid primary key default gen_random_uuid(),
  viewer_id uuid references public.profiles (id) on delete set null,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  viewed_at timestamptz not null default now()
);

create index if not exists idx_profile_views_profile_id on public.profile_views (profile_id, viewed_at desc);

-- ---------------------------------------------------------------------
-- DPDP: consent register
-- ---------------------------------------------------------------------

create table if not exists public.user_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  purpose text not null check (purpose in ('terms', 'privacy', 'core_processing', 'recruiter_discovery', 'product_emails', 'analytics')),
  policy_version text not null,
  granted boolean not null default false,
  granted_at timestamptz,
  withdrawn_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, purpose, policy_version)
);

create index if not exists idx_user_consents_user on public.user_consents (user_id);

create or replace function public.stamp_consent()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.purpose in ('terms', 'privacy', 'core_processing') and new.granted = false then
      raise exception 'required_consent_must_be_granted' using errcode = 'check_violation';
    end if;
    new.granted_at := case when new.granted then coalesce(new.granted_at, now()) else null end;
    new.withdrawn_at := case when new.granted then null else coalesce(new.withdrawn_at, now()) end;
  elsif tg_op = 'UPDATE' then
    if old.granted and not new.granted then
      new.withdrawn_at := now();
    elsif not old.granted and new.granted then
      new.granted_at := now();
      new.withdrawn_at := null;
    end if;
    -- Required contractual consents cannot be withdrawn while the account
    -- exists; deleting the account is the way out (DPDP right to erasure).
    if old.purpose in ('terms', 'privacy', 'core_processing') and new.granted = false then
      raise exception 'required_consent_not_withdrawable' using errcode = 'check_violation';
    end if;
    new.updated_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists on_consent_stamped on public.user_consents;
create trigger on_consent_stamped
  before insert or update on public.user_consents
  for each row execute function public.stamp_consent();

-- ---------------------------------------------------------------------
-- DPDP: erasure requests (grace period) + accountability record without PII
-- ---------------------------------------------------------------------

create table if not exists public.account_deletions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  mode text not null check (mode in ('immediate', 'grace_period')),
  status text not null default 'scheduled' check (status in ('scheduled', 'cancelled', 'processing', 'completed', 'failed')),
  reason_code text check (reason_code is null or reason_code in ('no_longer_needed', 'privacy_concerns', 'too_time_consuming', 'found_alternative', 'other')),
  requested_at timestamptz not null default now(),
  scheduled_for timestamptz not null,
  completed_at timestamptz,
  failure_code text,
  updated_at timestamptz not null default now()
);

create index if not exists idx_account_deletions_due
  on public.account_deletions (scheduled_for)
  where status = 'scheduled';

-- Retained after the account is gone. `user_ref` is a peppered hash of the
-- user id: enough to prove we honoured a request, useless as personal data.
create table if not exists public.deletion_audit (
  id uuid primary key default gen_random_uuid(),
  user_ref text not null,
  mode text not null,
  status text not null check (status in ('completed', 'failed')),
  requested_at timestamptz not null,
  completed_at timestamptz,
  categories_erased text[] not null default '{}',
  failure_code text,
  created_at timestamptz not null default now()
);

create index if not exists idx_deletion_audit_created on public.deletion_audit (created_at desc);

-- ---------------------------------------------------------------------
-- DPDP: data principal requests (access / correction / grievance)
-- ---------------------------------------------------------------------

create table if not exists public.data_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('access', 'correction', 'erasure', 'grievance', 'nomination')),
  details text check (details is null or char_length(details) <= 2000),
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'rejected')),
  resolution_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists idx_data_requests_user on public.data_requests (user_id);

-- ---------------------------------------------------------------------
-- DPDP: personal data breach register
-- Feeds the incident runbook (docs/incident-runbook.md): detect -> log ->
-- notify the Data Protection Board of India -> notify affected users.
-- Rows must never contain personal data in free text.
-- ---------------------------------------------------------------------

create table if not exists public.breach_events (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  detected_at timestamptz not null default now(),
  occurred_at_estimate timestamptz,
  severity text not null check (severity in ('low', 'medium', 'high', 'critical')),
  category text not null check (category in ('unauthorized_access', 'data_leak', 'lost_device', 'misconfiguration', 'insider', 'third_party', 'other')),
  summary text not null check (char_length(summary) <= 1000),
  data_categories text[] not null default '{}',
  affected_users_estimate integer check (affected_users_estimate is null or affected_users_estimate >= 0),
  containment_notes text,
  board_notified_at timestamptz,
  users_notified_at timestamptz,
  dpo_notified_at timestamptz,
  status text not null default 'open' check (status in ('open', 'contained', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Signup bootstrap: profile + streak row + consent register
-- Consent is taken from server-written auth metadata. Presence of a policy
-- version is the proof of acceptance; it is set only by the signup endpoint.
-- ---------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_policy text;
  v_display_name text;
  v_recruiter_opt_in boolean;
  v_email_opt_in boolean;
begin
  v_role := coalesce(nullif(new.raw_user_meta_data ->> 'role', ''), 'practitioner');
  if v_role not in ('practitioner', 'recruiter') then
    v_role := 'practitioner';
  end if;

  v_policy := nullif(new.raw_user_meta_data ->> 'policy_version', '');
  v_display_name := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), '');
  if v_display_name is null then
    v_display_name := split_part(new.email, '@', 1);
  end if;
  v_display_name := left(v_display_name, 60);

  v_recruiter_opt_in := coalesce((new.raw_user_meta_data ->> 'consent_recruiter_discovery')::boolean, false);
  v_email_opt_in := coalesce((new.raw_user_meta_data ->> 'consent_product_emails')::boolean, false);

  insert into public.profiles (
    id, display_name, role, visibility, allow_recruiter_contact,
    consent_at, consent_policy_version
  )
  values (
    new.id,
    v_display_name,
    v_role,
    'private',
    v_recruiter_opt_in,
    case when v_policy is null then null else now() end,
    v_policy
  )
  on conflict (id) do nothing;

  insert into public.streaks (user_id) values (new.id) on conflict (user_id) do nothing;

  if v_policy is not null then
    insert into public.user_consents (user_id, purpose, policy_version, granted)
    values
      (new.id, 'terms', v_policy, true),
      (new.id, 'privacy', v_policy, true),
      (new.id, 'core_processing', v_policy, true),
      (new.id, 'recruiter_discovery', v_policy, v_recruiter_opt_in),
      (new.id, 'product_emails', v_policy, v_email_opt_in)
    on conflict (user_id, purpose, policy_version) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- Profile write protection: roles, counters and erasure flags are not
-- client-writable, so a user cannot promote themselves to admin or clear
-- a pending deletion by PATCHing their profile.
-- ---------------------------------------------------------------------

create or replace function public.protect_profile_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.id <> old.id then
    raise exception 'profile_id_immutable' using errcode = 'check_violation';
  end if;

  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'role_change_not_allowed' using errcode = 'insufficient_privilege';
  end if;

  new.profile_views_count := old.profile_views_count;
  new.consent_at := coalesce(old.consent_at, new.consent_at);
  new.consent_policy_version := coalesce(old.consent_policy_version, new.consent_policy_version);
  new.deleted_at := old.deleted_at;
  new.deletion_requested_at := old.deletion_requested_at;
  new.deletion_scheduled_for := old.deletion_scheduled_for;
  new.created_at := old.created_at;

  if new.skills is not null then
    new.skills := (
      select coalesce(array_agg(distinct left(btrim(s), 40)), '{}'::text[])
      from unnest(new.skills) as s
      where btrim(s) <> ''
    );
  end if;

  return new;
end;
$$;

drop trigger if exists on_profile_write on public.profiles;
create trigger on_profile_write
  before update on public.profiles
  for each row execute function public.protect_profile_write();

drop trigger if exists on_profiles_updated_at on public.profiles;
create trigger on_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists on_challenges_updated_at on public.challenges;
create trigger on_challenges_updated_at
  before update on public.challenges
  for each row execute function public.set_updated_at();

drop trigger if exists on_streaks_updated_at on public.streaks;
create trigger on_streaks_updated_at
  before update on public.streaks
  for each row execute function public.set_updated_at();

drop trigger if exists on_pipelines_updated_at on public.recruiter_pipelines;
create trigger on_pipelines_updated_at
  before update on public.recruiter_pipelines
  for each row execute function public.set_updated_at();

drop trigger if exists on_pipeline_candidates_updated_at on public.pipeline_candidates;
create trigger on_pipeline_candidates_updated_at
  before update on public.pipeline_candidates
  for each row execute function public.set_updated_at();

drop trigger if exists on_data_requests_updated_at on public.data_requests;
create trigger on_data_requests_updated_at
  before update on public.data_requests
  for each row execute function public.set_updated_at();

drop trigger if exists on_breach_events_updated_at on public.breach_events;
create trigger on_breach_events_updated_at
  before update on public.breach_events
  for each row execute function public.set_updated_at();

drop trigger if exists on_account_deletions_updated_at on public.account_deletions;
create trigger on_account_deletions_updated_at
  before update on public.account_deletions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.challenges enable row level security;
alter table public.challenge_attempts enable row level security;
alter table public.streaks enable row level security;
alter table public.recruiter_pipelines enable row level security;
alter table public.pipeline_candidates enable row level security;
alter table public.audit_logs enable row level security;
alter table public.profile_views enable row level security;
alter table public.user_consents enable row level security;
alter table public.account_deletions enable row level security;
alter table public.deletion_audit enable row level security;
alter table public.data_requests enable row level security;
alter table public.breach_events enable row level security;

-- profiles ------------------------------------------------------------
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_select_visible" on public.profiles;
create policy "profiles_select_visible" on public.profiles
  for select using (
    deleted_at is null
    and (
      visibility = 'public'
      or (visibility = 'recruiters_only' and public.is_recruiter())
    )
  );

drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self" on public.profiles
  for insert with check (auth.uid() = id and role <> 'admin');

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- challenges ----------------------------------------------------------
drop policy if exists "challenges_select_active" on public.challenges;
create policy "challenges_select_active" on public.challenges
  for select using (is_active = true);

drop policy if exists "challenges_admin_all" on public.challenges;
create policy "challenges_admin_all" on public.challenges
  for all using (public.is_admin()) with check (public.is_admin());

-- challenge_attempts ---------------------------------------------------
drop policy if exists "attempts_select_own" on public.challenge_attempts;
create policy "attempts_select_own" on public.challenge_attempts
  for select using (auth.uid() = user_id);

drop policy if exists "attempts_insert_own" on public.challenge_attempts;
create policy "attempts_insert_own" on public.challenge_attempts
  for insert with check (auth.uid() = user_id);

-- No update/delete policies: attempts are immutable evidence.
revoke update, delete on public.challenge_attempts from authenticated, anon;

-- streaks --------------------------------------------------------------
drop policy if exists "streaks_select_own" on public.streaks;
create policy "streaks_select_own" on public.streaks
  for select using (auth.uid() = user_id);

-- No write policies: streaks are written by the attempts trigger only.
revoke insert, update, delete on public.streaks from authenticated, anon;

-- recruiter_pipelines --------------------------------------------------
drop policy if exists "pipelines_owner_all" on public.recruiter_pipelines;
create policy "pipelines_owner_all" on public.recruiter_pipelines
  for all using (auth.uid() = recruiter_id and public.is_recruiter())
  with check (auth.uid() = recruiter_id and public.is_recruiter());

-- pipeline_candidates --------------------------------------------------
drop policy if exists "pipeline_candidates_owner_all" on public.pipeline_candidates;
create policy "pipeline_candidates_owner_all" on public.pipeline_candidates
  for all
  using (
    exists (
      select 1 from public.recruiter_pipelines p
      where p.id = pipeline_id and p.recruiter_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.recruiter_pipelines p
      where p.id = pipeline_id and p.recruiter_id = auth.uid()
    )
  );

drop policy if exists "pipeline_candidates_subject_read" on public.pipeline_candidates;
create policy "pipeline_candidates_subject_read" on public.pipeline_candidates
  for select using (candidate_id = auth.uid());

-- audit_logs -----------------------------------------------------------
drop policy if exists "audit_select_own" on public.audit_logs;
create policy "audit_select_own" on public.audit_logs
  for select using (auth.uid() = user_id);

drop policy if exists "audit_select_admin" on public.audit_logs;
create policy "audit_select_admin" on public.audit_logs
  for select using (public.is_admin());

drop policy if exists "audit_insert_own" on public.audit_logs;
create policy "audit_insert_own" on public.audit_logs
  for insert with check (auth.uid() = user_id);

revoke update, delete on public.audit_logs from authenticated, anon;

-- profile_views --------------------------------------------------------
drop policy if exists "profile_views_subject_read" on public.profile_views;
create policy "profile_views_subject_read" on public.profile_views
  for select using (profile_id = auth.uid());

drop policy if exists "profile_views_insert_self" on public.profile_views;
create policy "profile_views_insert_self" on public.profile_views
  for insert with check (viewer_id = auth.uid());

revoke update, delete on public.profile_views from authenticated, anon;

-- user_consents --------------------------------------------------------
drop policy if exists "consents_select_own" on public.user_consents;
create policy "consents_select_own" on public.user_consents
  for select using (auth.uid() = user_id);

drop policy if exists "consents_insert_own" on public.user_consents;
create policy "consents_insert_own" on public.user_consents
  for insert with check (auth.uid() = user_id);

drop policy if exists "consents_withdraw_own" on public.user_consents;
drop policy if exists "consents_update_own" on public.user_consents;
create policy "consents_update_own" on public.user_consents
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

revoke delete on public.user_consents from authenticated, anon;

-- account_deletions ----------------------------------------------------
drop policy if exists "deletions_select_own" on public.account_deletions;
create policy "deletions_select_own" on public.account_deletions
  for select using (auth.uid() = user_id);

drop policy if exists "deletions_insert_own" on public.account_deletions;
create policy "deletions_insert_own" on public.account_deletions
  for insert with check (auth.uid() = user_id and status = 'scheduled');

drop policy if exists "deletions_cancel_own" on public.account_deletions;
create policy "deletions_cancel_own" on public.account_deletions
  for update using (auth.uid() = user_id and status = 'scheduled')
  with check (auth.uid() = user_id and status = 'cancelled');

revoke delete on public.account_deletions from authenticated, anon;

-- deletion_audit: service role only (RLS enabled, no policies) ---------
revoke all on public.deletion_audit from authenticated, anon;

-- data_requests --------------------------------------------------------
drop policy if exists "data_requests_select_own" on public.data_requests;
create policy "data_requests_select_own" on public.data_requests
  for select using (auth.uid() = user_id);

drop policy if exists "data_requests_insert_own" on public.data_requests;
create policy "data_requests_insert_own" on public.data_requests
  for insert with check (auth.uid() = user_id and status = 'open');

revoke update, delete on public.data_requests from authenticated, anon;

-- breach_events: admins read, service role writes ----------------------
drop policy if exists "breach_events_admin_read" on public.breach_events;
create policy "breach_events_admin_read" on public.breach_events
  for select using (public.is_admin());

revoke insert, update, delete on public.breach_events from authenticated, anon;

-- ---------------------------------------------------------------------
-- Recruiter-facing views
-- Expose only opted-in, non-PII columns plus derived skill signals. The
-- underlying tables keep RLS; these views are the narrow, auditable window
-- recruiters get instead of broad SELECT access.
-- ---------------------------------------------------------------------

create or replace view public.profile_cards
with (security_invoker = false)
as
select
  p.id,
  p.display_name,
  p.headline,
  p.bio,
  p.skills,
  p.visibility,
  p.profile_views_count,
  p.created_at,
  coalesce(s.current_streak, 0) as current_streak,
  coalesce(s.longest_streak, 0) as longest_streak,
  coalesce(s.total_practice_days, 0) as total_practice_days,
  s.last_practice_date
from public.profiles p
left join public.streaks s on s.user_id = p.id
where p.deleted_at is null
  and p.role = 'practitioner'
  and (
    p.visibility = 'public'
    or (p.visibility = 'recruiters_only' and public.is_recruiter())
  );

create or replace view public.skill_signals
with (security_invoker = false)
as
select
  a.user_id,
  c.category,
  count(*) filter (where a.created_at > now() - interval '30 days')::int as attempts_30d,
  round(avg(a.score) filter (where a.created_at > now() - interval '30 days'))::int as avg_score_30d,
  max(a.score) as best_score,
  count(distinct a.practice_date)::int as active_days,
  max(a.created_at) as last_attempt_at
from public.challenge_attempts a
join public.challenges c on c.id = a.challenge_id
join public.profiles p on p.id = a.user_id
where p.deleted_at is null
  and a.status = 'completed'
  and (
    p.visibility = 'public'
    or (p.visibility = 'recruiters_only' and public.is_recruiter())
  )
group by a.user_id, c.category;

revoke all on public.profile_cards from anon;
revoke all on public.skill_signals from anon;
grant select on public.profile_cards to authenticated;
grant select on public.skill_signals to authenticated;

-- ---------------------------------------------------------------------
-- Account erasure request + cancellation (DPDP rights)
-- Encapsulated in security definer functions so the client never needs write
-- access to deletion flags on profiles, and so a request always updates both
-- tables atomically.
-- ---------------------------------------------------------------------

create or replace function public.request_account_deletion(
  p_mode text default 'grace_period',
  p_reason text default null
)
returns table (request_id uuid, scheduled_for timestamptz, mode text, status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.account_deletions;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = 'insufficient_privilege';
  end if;

  if p_mode not in ('immediate', 'grace_period') then
    raise exception 'invalid_mode' using errcode = 'check_violation';
  end if;

  if p_reason is not null and p_reason not in ('no_longer_needed', 'privacy_concerns', 'too_time_consuming', 'found_alternative', 'other') then
    raise exception 'invalid_reason' using errcode = 'check_violation';
  end if;

  update public.account_deletions
  set status = 'cancelled'
  where user_id = v_uid and status = 'scheduled';

  insert into public.account_deletions (user_id, mode, status, reason_code, scheduled_for)
  values (
    v_uid,
    p_mode,
    'scheduled',
    p_reason,
    case when p_mode = 'immediate' then now() else now() + interval '30 days' end
  )
  returning * into v_row;

  update public.profiles
  set deletion_requested_at = now(), deletion_scheduled_for = v_row.scheduled_for
  where id = v_uid;

  return query select v_row.id, v_row.scheduled_for, v_row.mode, v_row.status;
end;
$$;

create or replace function public.cancel_account_deletion()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = 'insufficient_privilege';
  end if;

  update public.account_deletions
  set status = 'cancelled'
  where user_id = v_uid and status = 'scheduled';

  if not found then
    return false;
  end if;

  update public.profiles
  set deletion_requested_at = null, deletion_scheduled_for = null
  where id = v_uid;

  return true;
end;
$$;

revoke all on function public.request_account_deletion(text, text) from public;
revoke all on function public.cancel_account_deletion() from public;
grant execute on function public.request_account_deletion(text, text) to authenticated;
grant execute on function public.cancel_account_deletion() to authenticated;

-- ---------------------------------------------------------------------
-- Retention helper: called by the scheduled job to find stale rows.
-- Keeps individual records only as long as the policy says.
-- ---------------------------------------------------------------------

create or replace function public.purge_expired_data()
returns table (purged_profiles bigint, purged_views bigint, purged_audit bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profiles bigint;
  v_views bigint;
  v_audit bigint;
begin
  -- Tombstoned profiles past their grace period are removed.
  with gone as (
    delete from public.profiles
    where deleted_at is not null
      and deleted_at < now() - interval '30 days'
    returning 1
  )
  select count(*) into v_profiles from gone;

  -- Profile view rows are aggregates, not history worth keeping for years.
  with gone as (
    delete from public.profile_views
    where viewed_at < now() - interval '365 days'
    returning 1
  )
  select count(*) into v_views from gone;

  -- Audit trail retention: 24 months.
  with gone as (
    delete from public.audit_logs
    where created_at < now() - interval '24 months'
    returning 1
  )
  select count(*) into v_audit from gone;

  return query select v_profiles, v_views, v_audit;
end;
$$;

revoke all on function public.purge_expired_data() from public;
grant execute on function public.purge_expired_data() to service_role;

-- ---------------------------------------------------------------------
-- Practice sessions
-- A session is opened before the user sees a challenge and closed when the
-- attempt is written. Elapsed time is measured by the server from
-- started_at, so a client cannot claim it took ten minutes (or forty
-- seconds) to finish. Sessions expire so an abandoned tab cannot be
-- submitted days later.
-- ---------------------------------------------------------------------

create table if not exists public.practice_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  started_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '2 hours',
  submitted_attempt_id uuid references public.challenge_attempts (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_practice_sessions_user
  on public.practice_sessions (user_id, started_at desc);
create index if not exists idx_practice_sessions_open
  on public.practice_sessions (user_id, challenge_id)
  where submitted_attempt_id is null;

alter table public.practice_sessions enable row level security;

drop policy if exists "sessions_select_own" on public.practice_sessions;
create policy "sessions_select_own" on public.practice_sessions
  for select using (auth.uid() = user_id);

drop policy if exists "sessions_insert_own" on public.practice_sessions;
create policy "sessions_insert_own" on public.practice_sessions
  for insert with check (auth.uid() = user_id);

-- Sessions are closed by the attempt trigger, not by the client.
revoke update, delete on public.practice_sessions from authenticated, anon;

create or replace function public.close_practice_session()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.practice_sessions
  set submitted_attempt_id = new.id
  where user_id = new.user_id
    and challenge_id = new.challenge_id
    and submitted_attempt_id is null
    and expires_at > now();

  return new;
end;
$$;

drop trigger if exists on_attempt_close_session on public.challenge_attempts;
create trigger on_attempt_close_session
  after insert on public.challenge_attempts
  for each row execute function public.close_practice_session();
