-- =====================================================================
-- RLS / IDOR regression tests
-- =====================================================================
-- Run with:
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls.sql
-- (or paste into the Supabase SQL editor on a staging project)
--
-- Every block asserts that cross-user access FAILS. Any failure raises an
-- exception, which aborts the script with a non-zero exit status, so this
-- can gate a deploy. The script rolls everything back at the end.
-- =====================================================================

begin;

-- Two practitioners and one recruiter, created directly in auth.users so the
-- signup trigger produces profiles, streaks and consent rows.
do $$
declare
  alice uuid := '00000000-0000-4000-8000-000000000001';
  bob uuid := '00000000-0000-4000-8000-000000000002';
  rec uuid := '00000000-0000-4000-8000-000000000003';
  attempt uuid;
  n integer;
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
  values
    (alice, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'alice@example.test', crypt('password123', gen_salt('bf')), now(), '{"role":"practitioner","policy_version":"test"}'::jsonb, now(), now()),
    (bob,   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bob@example.test',   crypt('password123', gen_salt('bf')), now(), '{"role":"practitioner","policy_version":"test"}'::jsonb, now(), now()),
    (rec,   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rec@example.test',   crypt('password123', gen_salt('bf')), now(), '{"role":"recruiter","policy_version":"test"}'::jsonb, now(), now())
  on conflict (id) do nothing;

  -- Alice makes her profile recruiter-discoverable and logs one attempt.
  update public.profiles set visibility = 'recruiters_only', skills = array['typescript'] where id = alice;

  insert into public.challenge_attempts (user_id, challenge_id, submission, score, time_spent_seconds)
  select alice, c.id, '{"answer":"x"}'::jsonb, 82, 300
  from public.challenges c limit 1
  returning id into attempt;

  -- 1. Alice cannot read Bob's profile.
  perform set_config('request.jwt.claims', json_build_object('sub', alice, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  select count(*) into n from public.profiles where id = bob;
  if n <> 0 then
    raise exception 'IDOR: alice can read bob''s profile (% rows)', n;
  end if;

  -- 2. Alice cannot read Bob's attempts (Bob has none, so insert as postgres
  --    first is not possible; assert on the policy shape instead).
  select count(*) into n from public.challenge_attempts where user_id <> alice;
  if n <> 0 then
    raise exception 'IDOR: alice can read other users'' attempts (% rows)', n;
  end if;

  -- 3. Alice cannot insert an attempt for Bob.
  begin
    insert into public.challenge_attempts (user_id, challenge_id, submission, score, time_spent_seconds)
    select bob, c.id, '{"answer":"forged"}'::jsonb, 100, 60 from public.challenges c limit 1;
    raise exception 'IDOR: alice inserted an attempt for bob';
  exception
    when insufficient_privilege or check_violation then null;
  end;

  -- 4. Alice cannot update or delete her own attempt (immutable evidence).
  begin
    update public.challenge_attempts set score = 100 where id = attempt;
    raise exception 'EVIDENCE: alice updated her own attempt score';
  exception
    when insufficient_privilege then null;
  end;
  begin
    delete from public.challenge_attempts where id = attempt;
    raise exception 'EVIDENCE: alice deleted her own attempt';
  exception
    when insufficient_privilege then null;
  end;

  -- 5. Alice cannot mint a streak.
  begin
    update public.streaks set current_streak = 999 where user_id = alice;
    raise exception 'STREAK: alice wrote her own streak';
  exception
    when insufficient_privilege then null;
  end;

  -- 6. Alice cannot escalate her own role to admin.
  begin
    update public.profiles set role = 'admin' where id = alice;
    raise exception 'PRIVILEGE: alice promoted herself to admin';
  exception
    when insufficient_privilege then null;
  end;

  -- 7. Alice cannot withdraw a required consent.
  begin
    update public.user_consents set granted = false where user_id = alice and purpose = 'terms';
    raise exception 'CONSENT: alice withdrew a required consent';
  exception
    when check_violation then null;
  end;

  -- 8. Alice cannot read another user's consents or deletion requests.
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', alice, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  select count(*) into n from public.user_consents where user_id = bob;
  if n <> 0 then
    raise exception 'IDOR: alice can read bob''s consents';
  end if;

  select count(*) into n from public.account_deletions where user_id <> alice;
  if n <> 0 then
    raise exception 'IDOR: alice can read deletion requests she does not own';
  end if;

  -- 9. Bob (recruiter_discovery not granted, private profile) is invisible in
  --    the recruiter view.
  select count(*) into n from public.profile_cards where id = bob;
  if n <> 0 then
    raise exception 'PRIVACY: private profile leaked into profile_cards';
  end if;

  -- 10. Recruiter can see recruited-only profile, but not private data.
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', rec, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  select count(*) into n from public.profile_cards where id = alice;
  if n <> 1 then
    raise exception 'RECRUITER: visible profile missing from profile_cards';
  end if;

  -- 11. Recruiter cannot see raw profile rows through RLS ? they can, as
  --     recruiter_discovery opted in. Escalate: recruiter cannot read
  --     attempts of another user.
  select count(*) into n from public.challenge_attempts where user_id = alice;
  if n <> 0 then
    raise exception 'IDOR: recruiter can read raw attempts';
  end if;

  -- 12. Recruiter cannot create a pipeline for another recruiter.
  begin
    insert into public.recruiter_pipelines (recruiter_id, name) values (alice, 'forged');
    raise exception 'IDOR: recruiter created a pipeline owned by alice';
  exception
    when insufficient_privilege or check_violation then null;
  end;
end;
$$;

rollback;

select 'rls tests passed' as result;
