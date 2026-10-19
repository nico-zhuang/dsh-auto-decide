import test from 'node:test';
import assert from 'node:assert/strict';
import { autoAnswer, registerQuestionTimeout } from '../runtime.js';

const question = { id: 'q', question: 'Choose a local view', options: [
  { label: 'Compact view (Recommended)' }, { label: 'B' },
] };
const config = (mode = 'skip') => ({ enabled: true, mode, timeoutSeconds: 1 });
const agent = notes => ({ inject: note => notes.push(note) });

test('a human answer wins before timeout and never creates an automation note', async () => {
  const notes = [];
  const req = { questions: [question] };
  const value = await autoAnswer(req, () => Promise.resolve({ answers: [{ id: 'q', selected: ['B'] }] }),
    { mode: 'recommended', timeoutSeconds: 1 }, { config: config('recommended'), agent: agent(notes) });
  assert.equal(value.answers[0].selected[0], 'B');
  assert.equal(notes.length, 0);
  assert.equal(req.signal, undefined);
});

test('timeout skips a pending question, records provenance, and cancels the old UI', async () => {
  const notes = [];
  const req = { questions: [question] };
  let forwardedAborted = false;
  const pendingHuman = () => new Promise((resolve, reject) => {
    req.signal.addEventListener('abort', () => { forwardedAborted = true; reject(req.signal.reason); }, { once: true });
  });
  const value = await autoAnswer(req, pendingHuman, { mode: 'skip', timeoutSeconds: 1 },
    { config: config(), agent: agent(notes) });
  assert.deepEqual(value, { answers: [{ id: 'q', selected: [] }] });
  assert.equal(forwardedAborted, true);
  assert.equal(notes.length, 1);
  const detail = JSON.parse(notes[0].content[0].text);
  assert.equal(detail.humanConfirmed, false);
  assert.equal(detail.questions[0].options[0].label, 'Compact view (Recommended)');
});

test('no UI provider still times out and chooses the only recommendation', async () => {
  const notes = [];
  const req = { questions: [question] };
  const nope = Object.assign(new Error('No provider'), { code: 'NO_PROVIDER' });
  const value = await autoAnswer(req, () => Promise.reject(nope), { mode: 'recommended', timeoutSeconds: 1 },
    { config: config('recommended'), agent: agent(notes) });
  assert.deepEqual(value.answers[0].selected, ['Compact view (Recommended)']);
  assert.equal(notes.length, 1);
});

test('a logger failure cannot turn an injected auto answer back into an error', async () => {
  const notes = [];
  const req = { questions: [question] };
  const nope = Object.assign(new Error('No provider'), { code: 'NO_PROVIDER' });
  const value = await autoAnswer(req, () => Promise.reject(nope), { mode: 'skip', timeoutSeconds: 1 }, {
    config: config(), agent: agent(notes), onAuto: () => { throw new Error('logger unavailable'); },
  });
  assert.deepEqual(value.answers, [{ id: 'q', selected: [] }]);
  assert.equal(notes.length, 1);
});

test('missing recommendation falls back to a skipped answer', async () => {
  const notes = [];
  const req = { questions: [{ ...question, options: [{ label: 'A' }, { label: 'B' }] }] };
  const nope = Object.assign(new Error('No provider'), { code: 'NO_PROVIDER' });
  const value = await autoAnswer(req, () => Promise.reject(nope), { mode: 'recommended', timeoutSeconds: 1 },
    { config: config('recommended'), agent: agent(notes) });
  assert.deepEqual(value.answers, [{ id: 'q', selected: [] }]);
  assert.equal(JSON.parse(notes[0].content[0].text).outcome, 'skipped');
});

test('unloading the plugin disarms automation without cancelling the human card', async () => {
  const notes = [];
  const stop = new AbortController();
  const req = { questions: [question] };
  let resolveHuman;
  const awaitingHuman = new Promise(resolve => { resolveHuman = resolve; });
  const pending = autoAnswer(req, () => awaitingHuman, { mode: 'skip', timeoutSeconds: 1 },
    { config: config(), agent: agent(notes), shutdownSignal: stop.signal });
  stop.abort();
  resolveHuman({ answers: [{ id: 'q', selected: ['B'] }] });
  assert.deepEqual((await pending).answers[0].selected, ['B']);
  assert.equal(notes.length, 0);
});

test('changing the saved rule while a question waits avoids stale auto-decisions', async () => {
  const notes = [];
  const saved = config();
  const req = { questions: [question] };
  const pending = autoAnswer(req, () => new Promise(resolve => setTimeout(() => resolve({ answers: [{ id: 'q', selected: ['B'] }] }), 1100)),
    { mode: 'skip', timeoutSeconds: 1 }, { config: saved, agent: agent(notes) });
  saved.mode = 'recommended';
  assert.deepEqual((await pending).answers[0].selected, ['B']);
  assert.equal(notes.length, 0);
});

test('the Host hook excludes unrelated question services and plan review', async () => {
  const hooks = {};
  const notes = [];
  const a = agent(notes);
  const ctx = { on(name, cb) { hooks[name] = cb; return () => { delete hooks[name]; }; },
    logger: { info() {}, warn() {} } };
  const dispose = registerQuestionTimeout(ctx, config());
  const req = { agent: a, questions: [question] };
  const untouched = { answers: [{ id: 'q', selected: ['B'] }] };
  assert.equal(await hooks['user-questions/request'](req, () => untouched), untouched);
  assert.equal(await hooks['tools/execute']({ name: 'another_tool', agent: a },
    () => hooks['user-questions/request'](req, () => untouched)), untouched);
  const plan = { agent: a, questions: [{ ...question, detail: 'Review plan' }] };
  assert.equal(await hooks['tools/execute']({ name: 'ask_user_question', agent: a },
    () => hooks['user-questions/request'](plan, () => untouched)), untouched);
  assert.equal(notes.length, 0);
  dispose();
});
