const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(relative, mocks = {}) {
  const exports = {};
  const source = fs.readFileSync(path.join(__dirname, '..', relative), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
  } }).outputText;
  vm.runInNewContext(code, { exports, require: name => {
    assert.ok(name in mocks, `Unexpected dependency: ${name}`);
    return mocks[name];
  }, Date, console });
  return exports;
}
const progression = load('lib/learningProgression.ts');
const { attentionScore, selectLearningAttention, reviewProgress } = progression;
const now = Date.parse('2026-10-02T12:00:00Z');
const item = (id, overrides = {}) => ({id, mastery: 3, review_count: 1, importance: 5,
  next_review_at: new Date(now).toISOString(), created_at: '2026-10-01T12:00:00Z', ...overrides});
const ids = queue => Array.from(queue, row => row.id);

test('each ranking signal increases priority independently', () => {
  const base = item('base');
  const score = attentionScore(base, now);
  for (const overrides of [{mastery: 1}, {last_result: 'almost'}, {last_result: 'incorrect'},
    {incorrect_streak: 2}, {importance: 9}, {next_review_at: new Date(now - 86400000).toISOString()}]) {
    assert.ok(attentionScore(item('boost', overrides), now) > score);
  }
  assert.equal(attentionScore(item('x', {mastery: 1, last_result: 'incorrect', incorrect_streak: 2, importance: 8,
    next_review_at: new Date(now - 2 * 86400000).toISOString()}), now), 44);
});
test('incorrect outranks almost, which outranks correct with otherwise equal state', () => {
  assert.deepEqual(ids(selectLearningAttention(['correct','almost','incorrect'].map(result =>
    item(result, {last_result: result})), now)), ['incorrect','almost','correct']);
});
test('streak and overdue boosts are capped', () => {
  assert.equal(attentionScore(item('x', {incorrect_streak: 3}), now), attentionScore(item('x', {incorrect_streak: 30}), now));
  const old = days => item('x', {next_review_at: new Date(now - days * 86400000).toISOString()});
  assert.equal(attentionScore(old(7), now), attentionScore(old(70), now));
});
test('due boundary included; future and malformed dates excluded', () => {
  assert.deepEqual(ids(selectLearningAttention([item('now'), item('future', {next_review_at: new Date(now+1).toISOString()}),
    item('invalid', {next_review_at: 'bad'})], now)), ['now']);
});
test('queue is at most five with four reviewed and one new', () => {
  const rows = [...Array.from({length: 8}, (_, i) => item(`r${i}`)),
    ...Array.from({length: 8}, (_, i) => item(`n${i}`, {review_count: 0}))];
  const queue = selectLearningAttention(rows, now, 20);
  assert.equal(queue.length, 5);
  assert.equal(queue.filter(row => row.review_count === 0).length, 1);
  assert.equal(rows.length, 16);
});
test('no due reviewed material allows at most two new items', () => {
  const rows = [item('future', {next_review_at: new Date(now+1).toISOString()}),
    ...Array.from({length: 8}, (_, i) => item(`n${i}`, {review_count: 0, importance: i}))];
  assert.deepEqual(ids(selectLearningAttention(rows, now)), ['n7','n6']);
});
test('short reviewed queue does not fill unused slots with new items', () => {
  assert.equal(selectLearningAttention([item('r'), ...Array.from({length: 8}, (_, i) => item(`n${i}`, {review_count: 0}))], now).length, 2);
  assert.equal(selectLearningAttention(Array.from({length: 8}, (_, i) => item(`r${i}`)), now).length, 4);
});
test('smaller limits and empty queues are respected', () => {
  assert.equal(selectLearningAttention([item('r')], now, 0).length, 0);
  assert.equal(selectLearningAttention([item('r'), item('n', {review_count: 0})], now, 1).length, 1);
  assert.equal(selectLearningAttention([], now).length, 0);
});
test('ties use due time, creation time, then ID without mutating input', () => {
  const rows = [item('b'), item('a'), item('older', {created_at: '2026-09-01T00:00:00Z'}),
    item('earlier', {next_review_at: new Date(now-1000).toISOString()})];
  assert.deepEqual(ids(selectLearningAttention(rows, now)), ['earlier','older','a','b']);
  assert.deepEqual(ids(rows), ['b','a','older','earlier']);
});
test('legacy missing/null outcome fields are neutral', () => {
  assert.equal(attentionScore(item('old'), now), attentionScore(item('new', {last_result: null, incorrect_streak: 0}), now));
  assert.equal(reviewProgress(item('old'), 'incorrect', now).incorrect_streak, 1);
});
test('all results preserve mastery increments, schedules, counters, and last outcome', () => {
  for (let mastery = 0; mastery <= 5; mastery++) for (const result of ['correct','almost','incorrect']) {
    const state = item('x', {mastery, review_count: 4, incorrect_streak: 2});
    const update = reviewProgress(state, result, now);
    const expected = Math.min(5, mastery + (result === 'correct' ? 2 : result === 'almost' ? 1 : 0));
    assert.equal(update.mastery, expected);
    assert.equal(update.review_count, 5);
    assert.equal(update.last_result, result);
    assert.equal(update.incorrect_streak, result === 'incorrect' ? 3 : 0);
    const minutes = result === 'incorrect' ? 10 : result === 'almost' ? 30 : [60,1440,4320,10080,20160,43200][expected];
    assert.equal(Date.parse(update.next_review_at), now + minutes * 60000);
    assert.equal(Date.parse(update.updated_at), now);
  }
});
test('consecutive incorrect attempts accumulate; almost/correct reset the streak', () => {
  const first = reviewProgress(item('x'), 'incorrect', now);
  const second = reviewProgress(first, 'incorrect', now);
  assert.equal(second.incorrect_streak, 2);
  for (const result of ['almost','correct']) assert.equal(reviewProgress(second, result, now).incorrect_streak, 0);
});

function learningWith(db) {
  return load('lib/camiLearning.ts', {'./supabase': {supabaseAdmin: db}, './learningProgression': progression});
}
test('loader paginates before ranking, including high-priority items on later pages', async () => {
  let offset, requests = 0;
  const db = {from(table) { assert.equal(table, 'learning_events'); return {
    select() {return this}, lte(column) {assert.equal(column, 'next_review_at'); return this},
    order(column) {assert.equal(column, 'id'); return this},
    async range(start, end) {offset = start; requests++; assert.equal(end-start, 499);
      return {data: start === 0 ? Array.from({length: 500}, (_, i) => item(`r${i}`, {next_review_at: '2020-01-01T00:00:00Z'})) : [item('weak', {mastery: 0, last_result: 'incorrect', next_review_at: '2020-01-01T00:00:00Z'})], error: null};}
  }}};
  const queue = await learningWith(db).loadDueLearningEvents();
  assert.equal(offset, 500); assert.equal(requests, 2); assert.equal(queue[0].id, 'weak');
});
test('loader propagates database errors instead of claiming no work is due', async () => {
  const query = {select(){return this}, lte(){return this}, order(){return this}, async range(){return {error: new Error('db unavailable')}}};
  await assert.rejects(learningWith({from: () => query}).loadDueLearningEvents(), /db unavailable/);
});
test('review reads persisted state and writes outcome/streak with progression', async () => {
  let update;
  const current = item('x', {mastery: 2, review_count: 9, incorrect_streak: 3});
  const query = {select(){return this}, eq(column, id){assert.equal(column,'id'); assert.equal(id,'x'); return this},
    update(row){update = row; return this}, async single(){return {data: update ?? current, error: null}}};
  const result = await learningWith({from: () => query}).updateLearningReview('x', 'incorrect');
  assert.equal(result.mastery, 2); assert.equal(result.review_count, 10);
  assert.equal(result.last_result, 'incorrect'); assert.equal(result.incorrect_streak, 4);
});
test('failed persisted-state read prevents review write', async () => {
  let wrote = false;
  const query = {select(){return this}, eq(){return this}, update(){wrote=true; return this}, async single(){return {error: new Error('read failed')}}};
  await assert.rejects(learningWith({from: () => query}).updateLearningReview('x', 'almost'), /read failed/);
  assert.equal(wrote, false);
});
test('new event writes initialize neutral attention signals', async () => {
  let rows;
  const db = {from: () => ({async insert(value){rows=value; return {error:null}}})};
  await learningWith(db).saveLearningEvents([{type:'grammar', original:'ayer voy', correction:'ayer fui', importance:8}]);
  assert.equal(rows[0].last_result, null); assert.equal(rows[0].incorrect_streak, 0);
});

test('review API validates outcomes and ignores stale client counters', async () => {
  const calls = [];
  const route = load('app/api/learning-review/route.ts', {
    'next/server': {NextResponse: {json: (body, options) => ({body, status: options?.status ?? 200})}},
    '../../../lib/camiLearning': {async updateLearningReview(...args) {calls.push(args); return {id:args[0], last_result:args[1]}}},
  });
  for (const result of ['correct','almost','incorrect']) {
    const response = await route.POST({json: async () => ({id:'x', result, currentMastery:99, currentReviewCount:99})});
    assert.equal(response.status, 200);
    assert.deepEqual(Array.from(calls.at(-1)), ['x',result]);
  }
  for (const payload of [{id:'x', correct:true}, {id:'x', result:'invalid'}, {result:'correct'}]) {
    assert.equal((await route.POST({json:async () => payload})).status, 400);
  }
  assert.equal(calls.length, 3);
});
