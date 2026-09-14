import test from "node:test";
import assert from "node:assert/strict";
import { eloDelta, expectedScore } from "../src/rating/elo.js";

test("equal ratings expect a 50/50 outcome", () => {
  assert.equal(expectedScore(1200, 1200), 0.5);
});

test("a win against an equally-rated opponent gains half the K-factor", () => {
  assert.equal(eloDelta(1200, 1200, 1), 16);
});

test("a loss against an equally-rated opponent loses half the K-factor", () => {
  assert.equal(eloDelta(1200, 1200, 0), -16);
});

test("a draw against an equally-rated opponent changes nothing", () => {
  assert.equal(eloDelta(1200, 1200, 0.5), 0);
});

test("beating a much stronger opponent gains close to the full K-factor", () => {
  const delta = eloDelta(1200, 1800, 1);
  assert.ok(delta >= 30 && delta <= 32, `expected ~31-32, got ${delta}`);
});

test("losing to a much weaker opponent loses close to the full K-factor", () => {
  const delta = eloDelta(1800, 1200, 0);
  assert.ok(delta <= -30 && delta >= -32, `expected ~-31 to -32, got ${delta}`);
});

test("beating a much weaker opponent barely moves the rating", () => {
  const delta = eloDelta(1800, 1200, 1);
  assert.ok(delta >= 0 && delta <= 2, `expected ~0-2, got ${delta}`);
});
