import test from "node:test";
import assert from "node:assert/strict";
import { signToken, verifyToken } from "../src/auth/token.js";

test("a freshly signed token verifies back to the same user id", () => {
  const token = signToken("user-123");
  assert.equal(verifyToken(token), "user-123");
});

test("a tampered payload is rejected", () => {
  const token = signToken("user-123");
  const [, signature] = token.split(".");
  const forged = Buffer.from(JSON.stringify({ sub: "someone-else", exp: Date.now() + 1000 })).toString("base64url");
  assert.equal(verifyToken(`${forged}.${signature}`), null);
});

test("a tampered signature is rejected", () => {
  const token = signToken("user-123");
  const [encoded] = token.split(".");
  assert.equal(verifyToken(`${encoded}.not-a-real-signature`), null);
});

test("garbage input is rejected without throwing", () => {
  assert.equal(verifyToken("not-a-token-at-all"), null);
  assert.equal(verifyToken(""), null);
});

test("an expired token is rejected", (t) => {
  t.mock.timers.enable({ apis: ["Date"] });
  const token = signToken("user-123");
  t.mock.timers.tick(31 * 24 * 60 * 60 * 1000);
  assert.equal(verifyToken(token), null);
});
