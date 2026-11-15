import test from "node:test";
import assert from "node:assert/strict";

import {
  forgotPasswordSchema,
  newPasswordSchema,
  signUpSchema,
  startPracticeSessionSchema,
} from "./validations.ts";

test("password rules reject the weak cases they exist for", () => {
  const weak = ["short1A", "alllowercase1", "ALLUPPERCASE1", "NoNumberHere"];
  for (const password of weak) {
    const result = newPasswordSchema.safeParse({ password, confirmPassword: password });
    assert.equal(result.success, false, `should reject: ${password}`);
  }
});

test("a matching strong password is accepted", () => {
  const result = newPasswordSchema.safeParse({
    password: "QuietRiver42",
    confirmPassword: "QuietRiver42",
  });
  assert.equal(result.success, true);
});

test("confirmation mismatch fails on the confirm field", () => {
  const result = newPasswordSchema.safeParse({
    password: "QuietRiver42",
    confirmPassword: "QuietRiver43",
  });

  assert.equal(result.success, false);
  if (!result.success) {
    assert.deepEqual(result.error.issues[0].path, ["confirmPassword"]);
  }
});

test("signup cannot omit the required consent", () => {
  const base = {
    email: "person@example.test",
    password: "QuietRiver42",
    policyVersion: "2026-11-01",
  };

  assert.equal(signUpSchema.safeParse(base).success, false);
  assert.equal(signUpSchema.safeParse({ ...base, acceptedRequiredConsent: true }).success, true);
});

test("emails are normalised, so the same address cannot create two records", () => {
  const parsed = signUpSchema.parse({
    email: "  Person@Example.TEST ",
    password: "QuietRiver42",
    policyVersion: "2026-11-01",
    acceptedRequiredConsent: true,
  });

  assert.equal(parsed.email, "person@example.test");
});

test("reset requests accept only real-looking addresses", () => {
  assert.equal(forgotPasswordSchema.safeParse({ email: "not-an-email" }).success, false);
  assert.equal(forgotPasswordSchema.safeParse({ email: "a@b.co" }).success, true);
});

test("a practice session must reference a UUID, not a slug", () => {
  assert.equal(startPracticeSessionSchema.safeParse({ challengeId: "two-sum" }).success, false);
  assert.equal(
    startPracticeSessionSchema.safeParse({
      challengeId: "00000000-0000-4000-8000-000000000001",
    }).success,
    true
  );
});
