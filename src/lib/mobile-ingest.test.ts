import test from "node:test";
import assert from "node:assert/strict";
import {
  generateMobileAccessToken,
  generateMobilePairingCode,
  hashMobileAccessToken,
  hashMobilePairingCode,
  readBearerToken,
} from "./mobile-ingest.server.ts";

test("mobile pairing code is safe for manual entry and hashes canonically", () => {
  const code = generateMobilePairingCode();
  assert.match(code, /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{10}$/);
  assert.equal(hashMobilePairingCode(code), hashMobilePairingCode(code.toLowerCase()));
});

test("mobile access tokens are non-empty and hash deterministically", () => {
  const token = generateMobileAccessToken();
  assert.match(token, /^hmdev_[A-Za-z0-9_-]+$/);
  assert.equal(hashMobileAccessToken(token), hashMobileAccessToken(token));
});

test("bearer parser only accepts the bearer scheme", () => {
  assert.equal(readBearerToken("Bearer abc123"), "abc123");
  assert.equal(readBearerToken("bearer XYZ"), "XYZ");
  assert.equal(readBearerToken("Basic abc123"), null);
  assert.equal(readBearerToken(undefined), null);
});
