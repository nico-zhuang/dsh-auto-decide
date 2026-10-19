import test from 'node:test';
import assert from 'node:assert/strict';
import { answerFor, settingsOf, matchesSession } from '../policy.js';

const question = (questionText = '选择预览') => ({ id: 'q', question: questionText, options: [
  { label: '保留现状' }, { label: '独立预览 (Recommended)' },
] });
const request = q => ({ questions: [q] });

test('defaults to skip with configurable whole seconds', () => {
  assert.deepEqual(settingsOf({}), { enabled: true, mode: 'skip', timeoutSeconds: 120, scopeMode: 'global', sessionIds: [] });
  assert.equal(settingsOf({ timeoutSeconds: { get: () => 5 } }).timeoutSeconds, 5);
  assert.throws(() => settingsOf({ timeoutSeconds: 0 }));
  assert.throws(() => settingsOf({ timeoutSeconds: 2.5 }));
});

test('session modes target stable IDs and fail closed when ID is missing', () => {
  const ids = ['session-one', 'session-two'];
  assert.equal(matchesSession(settingsOf({}), undefined), true);
  assert.equal(matchesSession(settingsOf({ scopeMode: 'allowlist', sessionIds: ids }), 'session-one'), true);
  assert.equal(matchesSession(settingsOf({ scopeMode: 'allowlist', sessionIds: ids }), 'session-three'), false);
  assert.equal(matchesSession(settingsOf({ scopeMode: 'blocklist', sessionIds: ids }), 'session-one'), false);
  assert.equal(matchesSession(settingsOf({ scopeMode: 'blocklist', sessionIds: ids }), 'session-three'), true);
  assert.equal(matchesSession(settingsOf({ scopeMode: 'blocklist' }), 'session-three'), true);
  assert.equal(matchesSession(settingsOf({ scopeMode: 'allowlist', sessionIds: ids }), undefined), false);
  assert.equal(matchesSession(settingsOf({ scopeMode: 'blocklist', sessionIds: ids }), undefined), false);
  assert.throws(() => settingsOf({ scopeMode: 'other' }));
  assert.throws(() => settingsOf({ sessionIds: [12] }));
  assert.throws(() => settingsOf({ sessionIds: ['session-one', 'session-one'] }));
});

test('skip always emits empty selections for complete question batches', () => {
  assert.deepEqual(answerFor({ questions: [question(), { ...question(), id: 'q2' }] }, 'skip'), {
    answers: [{ id: 'q', selected: [] }, { id: 'q2', selected: [] }],
  });
});

test('recommendation matches only one explicit label, retaining exact option text', () => {
  assert.deepEqual(answerFor(request(question()), 'recommended'), {
    answers: [{ id: 'q', selected: ['独立预览 (Recommended)'] }],
  });
  assert.equal(answerFor(request({ ...question(), options: [{ label: 'A' }] }), 'recommended'), null);
  assert.equal(answerFor(request({ ...question(), multiSelect: true }), 'recommended'), null);
  assert.equal(answerFor(request({ ...question(), options: [
    { label: 'A (Recommended)' }, { label: 'B (Recommended)' },
  ] }), 'recommended'), null);
});

test('sensitive actions and review intents are not recommended', () => {
  assert.equal(answerFor(request(question('允许部署独立预览页面吗？')), 'recommended'), null);
  assert.equal(answerFor(request(question('同意将资料发送给第三方？')), 'recommended'), null);
  assert.equal(answerFor(request(question('May I share customer contacts externally?')), 'recommended'), null);
  assert.equal(answerFor(request(question('先把生产库清空，再展示预览')), 'recommended'), null);
  assert.equal(answerFor(request(question('决定如何把通讯录贴到公共板？')), 'recommended'), null);
  assert.equal(answerFor(request({ ...question('请选择纯文字显示样式'), options: [
    { label: '方案甲 (Recommended)' }, { label: '方案乙' },
  ] }), 'recommended'), null);
  assert.equal(answerFor(request({ ...question(), options: [{ label: 'Approve (Recommended)' }, { label: 'No' }] }), 'recommended'), null);
  assert.equal(answerFor(request({ ...question(), intent: { kind: 'plan-review' } }), 'skip'), null);
  assert.equal(answerFor(request({ ...question(), detail: 'plan markdown' }), 'skip'), null);
  assert.equal(answerFor(request({ ...question(), id: '' }), 'skip'), null);
});
