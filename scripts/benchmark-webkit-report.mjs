// Consume the official Playwright JSON report; never infer a successful
// six-button/real-touch result from a source-level grep alone.
import assert from 'node:assert/strict'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const [input, game, out] = process.argv.slice(2)
assert.ok(input && game && out, 'usage: node scripts/benchmark-webkit-report.mjs <report> <game> <out>')
assert.ok(['color-match', 'fist-legend'].includes(game), 'unrecognized benchmark title')
const report = JSON.parse(readFileSync(input, 'utf8'))
const all = []
function collect(suites) {
  assert.ok(Array.isArray(suites), 'Playwright suites missing')
  for (const suite of suites) {
    if (Array.isArray(suite.suites)) collect(suite.suites)
    if (Array.isArray(suite.specs)) {
      for (const spec of suite.specs) {
        for (const test of spec.tests || []) {
          all.push({
            name: spec.title,
            project: test.projectName,
            outcomes: (test.results || []).map(result => result.status)
          })
        }
      }
    }
  }
}
collect(report.suites)
assert.ok(all.length >= 3, game + ': too few Playwright tests executed')
assert.equal(report.stats?.unexpected, 0, game + ': failed/aborted tests in JSON report')
assert.equal(report.stats?.flaky, 0, game + ': retries detected; not an independent first-pass positive control')
assert.equal(report.stats?.skipped, 0, game + ': tests were skipped')
assert.ok(all.every(item => item.outcomes.length === 1 && item.outcomes[0] === 'passed'),
  game + ': each test must pass once, with no retry or skipped test')
const relevant = game === 'color-match'
  ? all.some(item => /six individual answer parts are visible and operable/.test(item.name))
  : all.some(item => /short portrait separates opponent guidance and keeps primary actions touchable/.test(item.name))
assert.ok(relevant, game + ': required gameplay interaction test missing')
mkdirSync(path.dirname(out), { recursive: true })
const payload = {
  task_id: 'project002-webkit-01',
  game, browser: 'webkit', status: 'current-main-positive-control',
  historical_failure_reproduced: false,
  ai_agent_trials_executed: 0,
  observed_tests: all.length,
  observed_single_attempt_passes: all.length,
  required_user_interaction_case_verified: true,
  artifact_is_model_benchmark: false,
  limitations: [
    'This checks current WebKit E2E and never launches an AI agent',
    'Original historical failure commit is not replayed',
    'No real phone interaction or paid-provider cost is measured',
  ]
}
writeFileSync(out, JSON.stringify(payload, null, 2) + '\n')
console.log('WebKit positive-control tests:', game, all.length)
