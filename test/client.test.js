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
  assert.equal(moduleFactory.id, 'dsh-auto-decide');
  const state = [];
  let stateIndex = 0;
  const React = {
    createElement: (tag, props, ...children) => ({ tag, props, children }),
    useSyncExternalStore: (subscribe, getSnapshot) => { subscribe(() => {}); return getSnapshot(); },
    useCallback: value => value,
    useState: value => {
      const index = stateIndex++;
      if (!(index in state)) state[index] = typeof value === 'function' ? value() : value;
      return [state[index], update => { state[index] = typeof update === 'function' ? update(state[index]) : update; }];
    },
    useEffect: () => {},
  };
  const client = moduleFactory.factory(name => { assert.equal(name, 'react'); return React; });
  assert.deepEqual(Array.from(client.inject), ['slots', 'configForms', 'sessions', 'workspaces', 'locale']);
  let configuredIds = ['session-one'];
  const form = { getSnapshot: () => ({ status: 'ready', writable: true, value: { enabled: true, mode: 'skip', timeoutSeconds: 120,
    scopeMode: 'allowlist', sessionIds: configuredIds } }),
    subscribe() { return () => {}; }, set: async () => true };
  const sessions = { list: { getSnapshot: () => ({ phase: 'ready', ids: ['session-one', 'session-two'], byId: {
    'session-one': { id: 'session-one', displayTitle: '主项目' },
    'session-two': { id: 'session-two', displayTitle: '其他项目' },
  } }), subscribe() { return () => {}; } } };
  const workspaces = { list: { getSnapshot: () => ({ phase: 'ready', archivedSessionIds: [] }), subscribe() { return () => {}; } } };
  let activeLocale = 'zh';
  let localeSubscriptions = 0;
  let dictionary;
  const locale = { getSnapshot: () => ({ active: activeLocale, revision: activeLocale === 'zh' ? 1 : 2 }),
    subscribe: () => { localeSubscriptions++; return () => {}; }, register: (ns, values) => { assert.equal(ns, 'dshAutoDecide'); dictionary = values; return () => {}; },
    bind: ns => { assert.equal(ns, 'dshAutoDecide'); return key => dictionary[activeLocale][key] ?? key; } };
  const ctx = { sessions, workspaces, locale, configForms: { get: name => { assert.equal(name, 'dsh-auto-decide'); return form; }, whileServed: (names, cb) => cb() },
    slots: { inject(name, cb) { assert.equal(name, 'plugins.row.config'); cb(); }, register(details, component) { registration = details; panel = component; } },
    effect(cb) { cb(); } };
  client.apply(ctx);
  assert.equal(registration.key, 'dsh-auto-decide#dsh-auto-decide');
  assert.deepEqual(Object.keys(dictionary.zh).sort(), Object.keys(dictionary.en).sort());
  const element = panel({ view: 'page' });
  assert.ok(localeSubscriptions > 0);
  assert.equal(element.tag, 'section');
  const all = node => Array.isArray(node) ? node.flatMap(all)
    : node && typeof node === 'object' && 'tag' in node ? [node, ...node.children.flatMap(all)] : [];
  const controls = all(element);
  assert.equal(controls.some(item => item.tag === 'h2'), false, 'the plugin page already has a title');
  assert.ok(controls.some(item => item.tag === 'details'), 'long safety help stays collapsed');
  const text = node => Array.isArray(node) ? node.map(text).join(' ')
    : node && typeof node === 'object' && 'children' in node ? text(node.children) : typeof node === 'string' ? node : '';
  assert.match(text(element), /适用会话/);
  assert.ok(controls.some(item => item.tag === 'select' && item.children.some(option => option?.props?.value === 'allowlist')));
  assert.ok(controls.some(item => item.tag === 'select' && item.children.some(option => option?.props?.value === 'blocklist')));
  const scoped = controls.filter(item => item.tag === 'input' && item.props.type === 'checkbox' && item.props.value?.startsWith('session-'));
  assert.equal(scoped.length, 2);
  assert.equal(scoped.find(item => item.props.value === 'session-one').props.checked, true);
  assert.equal(scoped.find(item => item.props.value === 'session-two').props.checked, false);
  scoped.find(item => item.props.value === 'session-two').props.onChange({ target: { checked: true } });
  stateIndex = 0;
  const selected = all(panel({ view: 'page' }));
  assert.equal(selected.find(item => item.tag === 'input' && item.props.value === 'session-two').props.checked, true);
  const saveList = selected.find(item => item.tag === 'button' && item.children.includes('保存名单'));
  assert.equal(saveList.props.disabled, false);
  const saved = [];
  form.set = async (field, value) => { saved.push([field, value]); return true; };
  return saveList.props.onClick().then(async () => {
    assert.equal(saved.length, 1);
    assert.equal(saved[0][0], 'sessionIds');
    assert.deepEqual(Array.from(saved[0][1]), ['session-one', 'session-two']);
    selected.find(item => item.tag === 'input' && item.props.type === 'search').props.onChange({ target: { value: '其他项目' } });
    stateIndex = 0;
    const searched = all(panel({ view: 'page' })).filter(item => item.tag === 'input' && item.props.value?.startsWith('session-'));
    assert.deepEqual(searched.map(item => item.props.value), ['session-two']);
    configuredIds = Array.from({ length: 122 }, (_, index) => `session-missing-${index}`);
    state.length = 0;
    stateIndex = 0;
    const firstPage = all(panel({ view: 'page' }));
    const missingInputs = firstPage.filter(item => item.tag === 'input' && item.props.value?.startsWith('session-missing-'));
    assert.equal(missingInputs.length, 120);
    const nextPage = firstPage.find(item => item.tag === 'button' && item.children.includes('下一页'));
    assert.ok(nextPage);
    nextPage.props.onClick();
    stateIndex = 0;
    const secondPage = all(panel({ view: 'page' }));
    assert.ok(secondPage.some(item => item.tag === 'input' && item.props.value === 'session-missing-121'));
    secondPage.find(item => item.tag === 'input' && item.props.type === 'search').props.onChange({ target: { value: 'session-missing-121' } });
    stateIndex = 0;
    const searchedMissing = all(panel({ view: 'page' })).filter(item => item.tag === 'input' && item.props.type === 'checkbox' && item.props.value?.startsWith('session-missing-'));
    assert.deepEqual(searchedMissing.map(item => item.props.value), ['session-missing-121']);
    form.set = async () => false;
    await saveList.props.onClick();
    activeLocale = 'en';
    stateIndex = 0;
    const english = panel({ view: 'page' });
    assert.match(text(english), /Sessions/);
    assert.match(text(english), /After timeout/);
    assert.match(text(english), /Could not save/);
    assert.doesNotMatch(text(english), /适用会话|保存已选会话|等待秒数/);
    assert.equal(all(english).some(item => item.tag === 'h2'), false);
  });
});
