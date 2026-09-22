'use strict';
// The tag a person pins and the version the install card names must agree.
// v1.0.2 shipped with rundock.json at 1.0.1, so the card read "Install
// csv-table 1.0.1?" beside "pinned to v1.0.2". These tests hold the check
// that stops a repeat, and run it against this repository's own tags.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const check = require('../scripts/check-version.js');

const ROOT = path.join(__dirname, '..');
const readJson = (name) => JSON.parse(fs.readFileSync(path.join(ROOT, name), 'utf8'));

test('a tag and a manifest that agree pass', () => {
  assert.equal(check.disagreement('v1.0.3', '1.0.3'), null);
  assert.equal(check.disagreement('1.0.3', '1.0.3'), null);
});

test('the v1.0.2 shape is refused, naming both versions', () => {
  const reason = check.disagreement('v1.0.2', '1.0.1');
  assert.match(reason, /1\.0\.1/);
  assert.match(reason, /1\.0\.2/);
});

test('a tag that is not a version, or a manifest with no version, is refused', () => {
  assert.match(check.disagreement('latest', '1.0.0'), /not a version tag/);
  assert.match(check.disagreement('v1.0.0', undefined), /no version/);
});

test('a known mismatch that has started agreeing is itself a failure', () => {
  const problems = check.checkAllTags(['v9.9.9'], () => ({ version: '9.9.9' }), { 'v9.9.9': 'test' });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /listed as a known mismatch but agrees/);
});

test('an unlisted mismatching tag fails the all-tags check', () => {
  const problems = check.checkAllTags(['v2.0.0'], () => ({ version: '1.9.0' }), {});
  assert.deepEqual(problems, ['v2.0.0: rundock.json says 1.9.0, the tag says 2.0.0']);
});

test('rundock.json and package.json name the same version', () => {
  assert.equal(readJson('rundock.json').version, readJson('package.json').version);
});

// The rest reads this repository's own history, so it needs the .git
// directory; a copy unpacked from an archive has none and skips it.
const inRepo = check.isRepository();

test('every tag in this repository agrees with its manifest, v1.0.2 excepted by name', { skip: !inRepo && 'not a git checkout' }, () => {
  assert.deepEqual(check.checkAllTags(), []);
});

test('the check would have caught v1.0.2', { skip: !inRepo && 'not a git checkout' }, () => {
  assert.ok(check.tags().includes('v1.0.2'));
  assert.notEqual(check.disagreement('v1.0.2', check.manifestAt('v1.0.2').version), null);
});
