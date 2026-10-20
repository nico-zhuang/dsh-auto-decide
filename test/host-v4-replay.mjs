// Optional DSH 0.2.1-rc.2 integration test. Install exact Host packages into
// an isolated directory, then set DSH_HOST_DEPS to that directory's node_modules.
// This creates only synthetic sessions under the OS temporary directory.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { isAbsolute, join } from 'node:path';
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

const root = await mkdtemp(join(tmpdir(), 'dsh-auto-decide-v4-'));
const id = randomUUID();
const notes = [];
const nope = Object.assign(new Error('No UI provider'), { code: 'NO_PROVIDER' });
const request = { questions: [{ id: 'format', question: 'Choose a display format', options: [{ label: 'Compact view' }] }] };
const config = { enabled: true, mode: 'skip', timeoutSeconds: 1 };
const result = await autoAnswer(request, () => Promise.reject(nope), config,
  { config, agent: { inject: message => notes.push(message) } });
assert.deepEqual(result.answers, [{ id: 'format', selected: [] }]);
assert.equal(notes.length, 1);
const message = notes[0];
assert.equal(message.role, 'user');
assert.ok(typeof message.id === 'string' && message.id.length > 0);
assert.equal(message.source.kind, 'dsh-auto-decide');
assert.equal(JSON.parse(message.content[0].text).humanConfirmed, false);

const session = Session.create(id);
const event = session.append('user/message', message, { surfaceOp: 'append' });
const writer = new Context();
try {
  await writer.plugin(Jsonl, { root, compression: 'zstd' });
  const handle = await writer.sessionPersistence.create(session.header);
  try { await handle.append([event]); await handle.flush(); }
  finally { await handle.close(); }
} finally { await writer.fiber.dispose(); }

// A fresh backend has no cached history; a strict V4 read must accept the
// exact message emitted by the plugin, rather than a hand-built stand-in.
const reader = new Context();
try {
  await reader.plugin(Jsonl, { root, compression: 'zstd' });
  const handle = await reader.sessionPersistence.open(id, 'read');
  try {
    const { events, eventState } = await handle.read();
    const restored = Session.fromRestore(id, events, handle.header, 0, eventState);
    assert.equal(SESSION_FORMAT_VERSION, 4);
    assert.equal(handle.header.version, 4);
    assert.deepEqual(restored.deriveMessages(), [message]);
    console.log('PASS DSH V4 zstd cold replay of actual dsh-auto-decide injection');
  } finally { await handle.close(); }
} finally { await reader.fiber.dispose(); }
