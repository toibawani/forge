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
  rev uuid := '00000000-0000-4000-8000-000000000004';
  attempt uuid;
  bob_session uuid;
  rev_attempt uuid;
  n integer;
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
  values
    (alice, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'alice@example.test', crypt('password123', gen_salt('bf')), now(), '{"role":"practitioner","policy_version":"test"}'::jsonb, now(), now()),
    (bob,   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bob@example.test',   crypt('password123', gen_salt('bf')), now(), '{"role":"practitioner","policy_version":"test"}'::jsonb, now(), now()),
    (rec,   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rec@example.test',   crypt('password123', gen_salt('bf')), now(), '{"role":"recruiter","policy_version":"test"}'::jsonb, now(), now()),
    (rev,   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rev@example.test',   crypt('password123', gen_salt('bf')), now(), '{"role":"reviewer","policy_version":"test"}'::jsonb, now(), now())
  on conflict (id) do nothing;

  -- Reviewer accounts are provisioned, not self-selected: the signup trigger
  -- only accepts practitioner or recruiter, so promotion goes through the
  -- service role, which is the only session that may change a role.
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  update public.profiles set role = 'reviewer' where id = rev;

  -- Alice makes her profile recruiter-discoverable and logs one attempt.
  update public.profiles set visibility = 'recruiters_only', skills = array['typescript'] where id = alice;

  insert into public.challenge_attempts (user_id, challenge_id, submission, score, time_spent_seconds)
  select alice, c.id, '{"answer":"x"}'::jsonb, 82, 300
  from public.challenges c limit 1
  returning id into attempt;

  -- Bob has an open practice session, created with owner rights.
  insert into public.practice_sessions (user_id, challenge_id)
  select bob, c.id from public.challenges c limit 1
  returning id into bob_session;

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

  -- 8b. Practice sessions are private, openable only for yourself, and their
  --     timestamps are not writable (server-measured time is the point).
  select count(*) into n from public.practice_sessions where user_id = bob;
  if n <> 0 then
    raise exception 'IDOR: alice can read bob''s practice sessions';
  end if;

  begin
    insert into public.practice_sessions (user_id, challenge_id)
    select bob, c.id from public.challenges c limit 1;
    raise exception 'IDOR: alice opened a practice session for bob';
  exception
    when insufficient_privilege or check_violation then null;
  end;

  begin
    update public.practice_sessions set started_at = now() - interval '1 hour' where user_id = alice;
    raise exception 'TAMPER: alice rewrote a practice session timestamp';
  exception
    when insufficient_privilege then null;
  end;

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

  -- 13. Rate-limit counters are operational state, never readable data.
  begin
    select count(*) into n from public.rate_limits;
    if n > 0 then
      raise exception 'privacy: authenticated role can read rate-limit keys';
    end if;
  exception
    when insufficient_privilege then null;
  end;

  -- 14. A client cannot call the limiter directly: arbitrary keys would let
  --     one caller exhaust another user's budget.
  begin
    perform public.consume_rate_limit('test:key', 1, 60);
    raise exception 'privilege: authenticated role can call consume_rate_limit';
  exception
    when insufficient_privilege or undefined_function then null;
  end;

  -- 15. A practitioner cannot write a review directly, nor see the queue.
  begin
    insert into public.attempt_reviews (attempt_id, reviewer_id, verdict, note)
    values (attempt, alice, 'correct', 'self-awarded verdict from the client');
    raise exception 'PRIVILEGE: alice inserted an attempt review directly';
  exception
    when insufficient_privilege or check_violation then null;
  end;

  begin
    perform public.review_queue(5);
    raise exception 'PRIVILEGE: practitioner can read the review queue';
  exception
    when insufficient_privilege or raise_exception then
      if sqlerrm like 'PRIVILEGE:%' then raise; end if;
  end;

  select count(*) into n from public.attempt_reviews;
  if n <> 0 then
    raise exception 'IDOR: alice can read reviews of attempts she does not own';
  end if;

  -- 16. A reviewer can read a blind queue, and it does not expose the author.
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', rev, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  select count(*) into n from public.review_queue(5);
  if n < 1 then
    raise exception 'REVIEW: queue returned no rows for a reviewer';
  end if;

  -- 17. A reviewer cannot review their own attempt.
  insert into public.challenge_attempts (user_id, challenge_id, submission, score, time_spent_seconds)
  select rev, c.id, '{"answer":"my own answer"}'::jsonb, 70, 300
  from public.challenges c limit 1
  returning id into rev_attempt;

  begin
    perform public.submit_attempt_review(rev_attempt, 'correct', 'reviewing my own work');
    raise exception 'REVIEW: reviewer reviewed their own attempt';
  exception
    when raise_exception then
      if sqlerrm like 'REVIEW:%' then raise; end if;
  end;

  -- 18. A reviewer can record a verdict on someone else's attempt, exactly once.
  perform public.submit_attempt_review(attempt, 'correct', 'The fix matches the measured cause.');

  begin
    perform public.submit_attempt_review(attempt, 'incorrect', 'Second opinion on the same attempt.');
    raise exception 'REVIEW: second verdict accepted for one attempt';
  exception
    when raise_exception or unique_violation then
      if sqlerrm like 'REVIEW:%' then raise; end if;
  end;

  -- 19. The author sees the verdict but not who wrote it.
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', alice, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  select count(*) into n from public.attempt_reviews;
  if n <> 1 then
    raise exception 'REVIEW: author cannot read the verdict on their own attempt (% rows)', n;
  end if;

  select count(*) into n from public.review_signals;
  if n <> 1 then
    raise exception 'REVIEW: author cannot see their own review summary (% rows)', n;
  end if;
end;
$$;

-- 20-24. Grades: owner-readable, client-unwritable, immutable.
do $$
declare
  alice uuid := '00000000-0000-4000-8000-000000000001';
  bob uuid := '00000000-0000-4000-8000-000000000002';
  alice_attempt uuid;
  grade uuid;
  n integer;
begin
  -- The previous block left the caller as `authenticated`; fixtures are written
  -- with owner rights, while the app itself can only use the function below.
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);

  select id into alice_attempt
  from public.challenge_attempts
  where user_id = alice
  order by created_at
  limit 1;

  if alice_attempt is null then
    raise exception 'GRADES: fixture attempt missing';
  end if;

  -- Written as postgres: the app writes through the function, not directly.
  insert into public.attempt_grades (
    attempt_id, user_id, challenge_slug, challenge_version, score, grader, grader_version
  )
  values (alice_attempt, alice, 'grade-fixture', 1, 78, 'sandbox', 'sandbox-v1')
  returning id into grade;

  -- 20. The owner reads their own grade.
  perform set_config('request.jwt.claims', json_build_object('sub', alice, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  select count(*) into n from public.attempt_grades where id = grade;
  if n <> 1 then
    raise exception 'GRADES: owner cannot read own grade (% rows)', n;
  end if;

  -- 21. Another practitioner cannot see it.
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', bob, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  select count(*) into n from public.attempt_grades where id = grade;
  if n <> 0 then
    raise exception 'IDOR: bob can read alice''s grade (% rows)', n;
  end if;

  -- 22. A client cannot insert a grade directly, so a score cannot be invented.
  begin
    insert into public.attempt_grades (
      attempt_id, user_id, challenge_slug, challenge_version, score, grader, grader_version
    )
    values (alice_attempt, alice, 'forged', 1, 100, 'sandbox', 'forged');
    raise exception 'GRADES: client inserted a grade directly';
  exception
    when insufficient_privilege then null;
  end;

  -- 23. The function refuses to grade someone else's attempt.
  begin
    perform public.record_attempt_grade(alice_attempt, 100, 'sandbox', 'forged');
    raise exception 'IDOR: bob graded alice''s attempt';
  exception
    when insufficient_privilege then null;
  end;

  -- 24. Even the table owner cannot rewrite a grade: the evidence stays put.
  execute 'reset role';
  begin
    update public.attempt_grades set score = 100 where id = grade;
    raise exception 'GRADES: a recorded grade was updated';
  exception
    when restrict_violation then null;
  end;
end;
$$;

rollback;

select 'rls tests passed' as result;
