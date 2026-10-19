import test from 'node:test';
import assert from 'node:assert/strict';
import { Config, apply } from '../index.js';

test('DSH schema exposes runtime-editable defaults and supports 5/120 seconds', () => {
  const defaults = Config({});
  assert.equal(defaults.enabled.get(), true);
  assert.equal(defaults.mode.get(), 'skip');
  assert.equal(defaults.timeoutSeconds.get(), 120);
  const short = Config({ enabled: true, mode: 'recommended', timeoutSeconds: 5 });
  assert.equal(short.mode.get(), 'recommended');
  assert.equal(short.timeoutSeconds.get(), 5);
  assert.throws(() => Config({ timeoutSeconds: 0 }));
});

test('Host entry wires and disposes both waterfall listeners as an effect', () => {
  const hooks = new Map();
  let stop;
  const ctx = { on(event, callback, options) {
    assert.equal(options.global, true);
    hooks.set(event, callback);
    return () => hooks.delete(event);
  }, effect(register) { stop = register(); }, logger: { info() {}, warn() {} } };
  apply(ctx, Config({}));
  assert.equal(typeof hooks.get('tools/execute'), 'function');
  assert.equal(typeof hooks.get('user-questions/request'), 'function');
  stop();
  assert.equal(hooks.size, 0);
});
