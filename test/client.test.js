import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

test('browser bundle declares its slot and mounts a settings panel without a second React copy', () => {
  let registration;
  let panel;
  let moduleFactory;
  const script = readFileSync(new URL('../client.js', import.meta.url), 'utf8');
  vm.runInNewContext(script, { window: { __ModuleLoader__: { load(value) { moduleFactory = value; } } } });
  assert.equal(moduleFactory.id, 'auto-decide');
  const React = {
    createElement: (tag, props, ...children) => ({ tag, props, children }),
    useSyncExternalStore: (subscribe, getSnapshot) => getSnapshot(),
    useCallback: value => value,
    useState: value => [value, () => {}],
    useEffect: () => {},
  };
  const client = moduleFactory.factory(name => { assert.equal(name, 'react'); return React; });
  assert.deepEqual(Array.from(client.inject), ['slots', 'configForms']);
  const form = { getSnapshot: () => ({ status: 'ready', writable: true, value: { enabled: true, mode: 'skip', timeoutSeconds: 120 } }),
    subscribe() { return () => {}; }, set: async () => true };
  const ctx = { configForms: { get: name => { assert.equal(name, 'auto-decide'); return form; }, whileServed: (names, cb) => cb() },
    slots: { inject(name, cb) { assert.equal(name, 'plugins.row.config'); cb(); }, register(details, component) { registration = details; panel = component; } },
    effect(cb) { cb(); } };
  client.apply(ctx);
  assert.equal(registration.key, 'auto-decide#auto-decide');
  const element = panel({ view: 'page' });
  assert.equal(element.tag, 'section');
});
