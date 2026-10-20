// DSH 0.2.1-rc.2 integration gate; invoked by test:release with isolated Host
// dependencies. Creates only synthetic sessions under the OS temporary directory.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, isAbsolute, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { autoAnswer } from '../runtime.js';

const deps = process.env.DSH_HOST_DEPS;
if (!deps || !isAbsolute(deps)) {
  throw new Error('Set DSH_HOST_DEPS to an isolated node_modules directory with @deepseek-ai/cordis, dsh-session and dsh-session-persistence-jsonl at DSH 0.2.1-rc.2');
}
const load = name => import(pathToFileURL(join(deps, name, 'lib/index.js')).href);
const { Context } = await load('@deepseek-ai/cordis');
const { Session, SESSION_FORMAT_VERSION } = await load('@deepseek-ai/dsh-session');
const Jsonl = await load('@deepseek-ai/dsh-session-persistence-jsonl');

const nope = Object.assign(new Error('No UI provider'), { code: 'NO_PROVIDER' });
const cases = [
  { mode: 'skip', question: 'Choose a display format', options: [{ label: 'Compact view' }], selected: [] },
  { mode: 'recommended', question: 'Choose a display format', options: [
    { label: 'Compact view (Recommended)' }, { label: 'Expanded view' },
  ], selected: ['Compact view (Recommended)'] },
];
const emitted = [];
for (const item of cases) {
  const notes = [];
  const config = { enabled: true, mode: item.mode, timeoutSeconds: 1 };
  const request = { questions: [{ id: 'format', question: item.question, options: item.options }] };
  const result = await autoAnswer(request, () => Promise.reject(nope), config,
    { config, agent: { inject: message => notes.push(message) } });
  assert.deepEqual(result.answers, [{ id: 'format', selected: item.selected }]);
  assert.equal(notes.length, 1, `${item.mode} must emit exactly one real message`);
  const message = notes[0];
  assert.equal(message.role, 'user');
  assert.ok(typeof message.id === 'string' && message.id.length > 0);
  assert.equal(message.source.kind, 'dsh-auto-decide');
  const note = JSON.parse(message.content[0].text);
  assert.equal(note.humanConfirmed, false);
  assert.equal(note.mode, item.mode);
  assert.deepEqual(note.answers, result.answers);
  emitted.push({ id: randomUUID(), message, mode: item.mode });
}
assert.notEqual(emitted[0].message.id, emitted[1].message.id);

const root = await mkdtemp(join(tmpdir(), 'dsh-auto-decide-v4-'));
try {
  const writer = new Context();
  try {
    await writer.plugin(Jsonl, { root, compression: 'zstd' });
    for (const { id, message } of emitted) {
      const session = Session.create(id);
      const event = session.append('user/message', message, { surfaceOp: 'append' });
      const handle = await writer.sessionPersistence.create(session.header);
      try { await handle.append([event]); await handle.flush(); }
      finally { await handle.close(); }
    }
  } finally { await writer.fiber.dispose(); }

  // A new backend has no cached history: strict V4 restores both exact messages
  // emitted by the plugin rather than hand-built substitutes.
  const reader = new Context();
  try {
    await reader.plugin(Jsonl, { root, compression: 'zstd' });
    for (const { id, message, mode } of emitted) {
      const handle = await reader.sessionPersistence.open(id, 'read');
      try {
        const { events, eventState } = await handle.read();
        const restored = Session.fromRestore(id, events, handle.header, 0, eventState);
        assert.equal(SESSION_FORMAT_VERSION, 4);
        assert.equal(handle.header.version, 4);
        assert.deepEqual(restored.deriveMessages(), [message]);
        console.log(`PASS DSH V4 zstd cold replay of actual ${mode} injection`);
      } finally { await handle.close(); }
    }
  } finally { await reader.fiber.dispose(); }
} finally {
  // The synthetic V4 sessions are disposable; never remove an unchecked path.
  const actual = await realpath(root);
  if (dirname(actual) !== await realpath(tmpdir()) || !basename(actual).startsWith('dsh-auto-decide-v4-')) {
    throw new Error(`Refusing to remove unexpected synthetic session path: ${actual}`);
  }
  await rm(actual, { recursive: true, force: true });
}
