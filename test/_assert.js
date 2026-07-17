/* Minimal zero-dependency assertion helper (pac-game style).
   Each test file creates a suite, runs checks, then calls suite.done()
   which prints "NAME: PASS/FAIL" and process.exit(1) on any failure. */

'use strict';

function suite(name) {
  var passed = 0, failed = 0, fails = [];

  function ok(cond, msg) {
    if (cond) { passed++; }
    else { failed++; fails.push(msg || 'assertion failed'); }
  }
  function near(actual, expected, eps, msg) {
    eps = eps == null ? 1e-6 : eps;
    var good = Math.abs(actual - expected) <= eps;
    ok(good, (msg || 'near') + ' — got ' + actual + ', expected ' + expected + ' ±' + eps);
  }
  function eq(a, b, msg) { ok(a === b, (msg || 'eq') + ' — got ' + a + ', expected ' + b); }
  function done() {
    console.log('  checks: ' + passed + ' passed, ' + failed + ' failed');
    fails.forEach(function (f) { console.error('  ✗ ' + f); });
    var ok2 = failed === 0;
    console.log(name + ': ' + (ok2 ? 'PASS' : 'FAIL'));
    if (!ok2) process.exit(1);
  }
  return { ok: ok, near: near, eq: eq, done: done };
}

module.exports = { suite: suite };
