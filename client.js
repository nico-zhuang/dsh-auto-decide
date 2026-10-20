window.__ModuleLoader__.load({
  id: 'dsh-auto-decide',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const ns = 'dshAutoDecide';
    const messages = {
      zh: {
        section: '提问自动处理设置', ordinary: '普通提问', enable: '启用自动处理', on: '已开启', off: '已暂停',
        scope: '适用会话', global: '所有会话', allowlist: '仅选中会话', blocklist: '排除选中会话', noSessions: '未覆盖任何会话',
        mode: '到时处理', skip: '跳过', recommended: '仅展示类推荐项', delay: '等待时间', seconds: '秒', save: '保存',
        selectSessions: '选择会话', chosen: '已选', emptyWhitelist: '空名单时不自动处理。新会话默认不在名单中。',
        emptyBlacklist: '空名单等于所有会话。新会话默认会自动处理。', search: '搜索会话',
        searchHint: '按标题或会话 ID 搜索', archived: '显示已归档', archivedSuffix: '已归档',
        missing: '已选但目录未显示', noMatches: '没有匹配的会话', narrowSearch: '仅显示前 120 条，可搜索更多会话。',
        previous: '上一页', next: '下一页', page: '页', saveSessions: '保存名单', directoryLoading: '会话目录加载中',
        saveFailed: '保存失败。设置可能已在别处更改，请刷新后重试。', configStatus: '配置状态',
        conciseRule: '仅普通提问；跳过不是同意。', help: '规则与安全',
        helpOne: '仅处理 ask_user_question 的普通提问。计划审阅和安全审批始终交给原有流程。',
        helpTwo: '推荐模式只选展示／格式类单选题中唯一标注 Recommended 的选项；其他情况跳过。',
        helpThree: '自动结果会明确标为非人工确认。更改配置后，等待中的问题不会沿用旧规则自动作答。',
      },
      en: {
        section: 'Automatic question handling settings', ordinary: 'Ordinary questions', enable: 'Enable automatic handling', on: 'On', off: 'Paused',
        scope: 'Sessions', global: 'All sessions', allowlist: 'Selected only', blocklist: 'Except selected', noSessions: 'No sessions covered',
        mode: 'After timeout', skip: 'Skip', recommended: 'Presentation choices only', delay: 'Wait', seconds: 'sec', save: 'Save',
        selectSessions: 'Choose sessions', chosen: 'Selected', emptyWhitelist: 'An empty list keeps every question manual. New sessions are not included.',
        emptyBlacklist: 'An empty list covers all sessions. New sessions are included automatically.', search: 'Find sessions',
        searchHint: 'Search title or session ID', archived: 'Show archived', archivedSuffix: 'archived',
        missing: 'Selected but no longer listed', noMatches: 'No matching sessions', narrowSearch: 'Showing the first 120; search for more.',
        previous: 'Previous', next: 'Next', page: 'page', saveSessions: 'Save selection', directoryLoading: 'Loading sessions',
        saveFailed: 'Could not save. Settings may have changed elsewhere; refresh and try again.', configStatus: 'Settings status',
        conciseRule: 'Ordinary questions only. Skipping is not consent.', help: 'Rules & safety',
        helpOne: 'Only ordinary ask_user_question prompts are handled. Plan review and security approval keep their original flow.',
        helpTwo: 'Recommended mode selects only a unique marked presentation/format choice; everything else is skipped.',
        helpThree: 'Automatic results are marked as not human-confirmed. Pending questions never reuse changed settings.',
      },
    };
    const style = {
      root: { width: '100%', maxWidth: 680, display: 'grid', gap: 12, color: 'var(--dsw-alias-label-primary)', fontFamily: 'var(--dsw-font-family, inherit)' },
      card: { padding: '18px clamp(14px, 2vw, 22px)', borderRadius: 'var(--dsw-radius-lg, 16px)', background: 'var(--dsw-alias-settings-card-fill, var(--dsw-alias-bg-layer-2))', border: '1px solid var(--dsw-alias-settings-card-stroke, var(--dsw-alias-border-l4))' },
      row: { display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
      spread: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' },
      muted: { color: 'var(--dsw-alias-label-secondary)', fontSize: 13, lineHeight: 1.5 },
      field: { display: 'grid', gap: 7, minWidth: 0, color: 'var(--dsw-alias-label-secondary)', fontSize: 13 },
      grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 14 },
      control: { boxSizing: 'border-box', minHeight: 38, width: '100%', maxWidth: '100%', padding: '7px 10px', borderRadius: 'var(--dsw-radius-sm, 8px)', border: '1px solid var(--dsw-alias-border-l3)', background: 'var(--dsw-alias-bg-layer-1)', color: 'var(--dsw-alias-label-primary)', font: 'inherit' },
      button: { minHeight: 38, padding: '6px 12px', borderRadius: 'var(--dsw-radius-sm, 8px)', border: '1px solid var(--dsw-alias-border-l3)', background: 'var(--dsw-alias-bg-layer-1)', color: 'var(--dsw-alias-label-primary)', font: 'inherit', cursor: 'pointer' },
    };
    return {
      inject: ['slots', 'configForms', 'sessions', 'workspaces', 'locale'],
      apply(ctx) {
        const form = ctx.configForms.get('dsh-auto-decide');
        const sessionsStore = ctx.sessions.list;
        const workspacesStore = ctx.workspaces.list;
        const t = ctx.locale.bind(ns);
        ctx.effect(() => ctx.locale.register(ns, messages), 'dsh-auto-decide: translations');
        function QuestionTimeoutSettings({ view }) {
          const snapshot = React.useSyncExternalStore(
            React.useCallback(listener => form.subscribe(listener), []),
            React.useCallback(() => form.getSnapshot(), []),
          );
          React.useSyncExternalStore(
            React.useCallback(listener => ctx.locale.subscribe(listener), []),
            React.useCallback(() => ctx.locale.getSnapshot(), []),
          );
          const sessionSnapshot = React.useSyncExternalStore(
            React.useCallback(listener => sessionsStore.subscribe(listener), []),
            React.useCallback(() => sessionsStore.getSnapshot(), []),
          );
          const workspaceSnapshot = React.useSyncExternalStore(
            React.useCallback(listener => workspacesStore.subscribe(listener), []),
            React.useCallback(() => workspacesStore.getSnapshot(), []),
          );
          const values = snapshot.value || {};
          const savedIds = Array.isArray(values.sessionIds) ? values.sessionIds : [];
          const savedKey = JSON.stringify(savedIds);
          const [seconds, setSeconds] = React.useState(String(values.timeoutSeconds ?? 120));
          const [draftIds, setDraftIds] = React.useState(() => [...savedIds]);
          const [query, setQuery] = React.useState('');
          const [showArchived, setShowArchived] = React.useState(false);
          const [missingPage, setMissingPage] = React.useState(0);
          const [busy, setBusy] = React.useState(false);
          const [error, setError] = React.useState('');
          React.useEffect(() => setSeconds(String(values.timeoutSeconds ?? 120)), [values.timeoutSeconds]);
          React.useEffect(() => setDraftIds([...savedIds]), [savedKey]);
          async function save(field, value) {
            setBusy(true); setError('');
            try {
              if (!await form.set(field, value)) setError('saveFailed');
            } catch { setError('saveFailed'); }
            finally { setBusy(false); }
          }
          const writable = snapshot.status === 'ready' && snapshot.writable && !busy;
          const interval = Number(seconds);
          const scopeMode = values.scopeMode ?? 'global';
          const scopeLabel = t(scopeMode);
          const answerLabel = t(values.mode === 'recommended' ? 'recommended' : 'skip');
          const ids = sessionSnapshot?.ids ?? [];
          const byId = sessionSnapshot?.byId ?? {};
          const archived = new Set(workspaceSnapshot?.archivedSessionIds ?? []);
          const directoryReady = sessionSnapshot?.phase === 'ready' && workspaceSnapshot?.phase === 'ready';
          const needle = query.trim().toLocaleLowerCase();
          const filtered = ids.map(id => ({ id, title: byId[id]?.displayTitle || id, archived: archived.has(id) }))
            .filter(item => (showArchived || !item.archived || draftIds.includes(item.id))
              && (!needle || `${item.title} ${item.id}`.toLocaleLowerCase().includes(needle)))
            .sort((a, b) => Number(draftIds.includes(b.id)) - Number(draftIds.includes(a.id)));
          const missing = draftIds.filter(id => !ids.includes(id) && (!needle || id.toLocaleLowerCase().includes(needle)));
          const missingPages = Math.max(1, Math.ceil(missing.length / 120));
          const visibleMissingPage = Math.min(missingPage, missingPages - 1);
          const dirty = JSON.stringify(draftIds) !== savedKey;
          if (view === 'summary') {
            if (snapshot.status !== 'ready') return h('span', null, `${t('ordinary')} · ${t('configStatus')}: ${snapshot.status}`);
            const prefix = `${t('ordinary')} · ${t(values.enabled === false ? 'off' : 'on')}`;
            if (values.enabled === false) return h('span', null, prefix);
            if (scopeMode === 'allowlist' && savedIds.length === 0) return h('span', null, `${prefix} · ${scopeLabel} · ${t('noSessions')}`);
            return h('span', null, `${prefix} · ${scopeLabel} · ${values.timeoutSeconds ?? 120} ${t('seconds')} · ${answerLabel}`);
          }
          return h('section', { style: style.root, 'aria-label': t('section') },
            h('div', { style: style.card },
              h('div', { style: style.spread },
                h('div', null,
                  h('div', { style: { fontSize: 16, fontWeight: 650, letterSpacing: '-0.01em' } }, t('ordinary')),
                  h('div', { style: { ...style.muted, marginTop: 3 } }, t('conciseRule'))),
                h('label', { style: { ...style.row, cursor: writable ? 'pointer' : 'default' } },
                  h('input', { type: 'checkbox', role: 'switch', checked: values.enabled ?? true, disabled: !writable,
                    'aria-label': t('enable'), onChange: event => save('enabled', event.target.checked) }),
                  h('span', { style: { fontSize: 13, fontWeight: 600, color: values.enabled === false ? 'var(--dsw-alias-label-secondary)' : 'var(--dsw-alias-state-business-primary)' } }, t(values.enabled === false ? 'off' : 'on')))),
              h('div', { style: { ...style.grid, marginTop: 18 } },
                h('label', { style: style.field }, t('scope'), h('select', { value: scopeMode, disabled: !writable,
                  onChange: event => save('scopeMode', event.target.value), style: style.control },
                  h('option', { value: 'global' }, t('global')),
                  h('option', { value: 'allowlist' }, t('allowlist')),
                  h('option', { value: 'blocklist' }, t('blocklist')))),
                h('label', { style: style.field }, t('mode'), h('select', { value: values.mode ?? 'skip', disabled: !writable,
                  onChange: event => save('mode', event.target.value), style: style.control },
                  h('option', { value: 'skip' }, t('skip')),
                  h('option', { value: 'recommended' }, t('recommended')))),
                h('label', { style: style.field }, t('delay'),
                  h('span', { style: { ...style.row, flexWrap: 'nowrap' } },
                    h('input', { type: 'number', min: 1, max: 3600, step: 1, value: seconds, disabled: !writable,
                      onChange: event => setSeconds(event.target.value), style: { ...style.control, width: 82 }, 'aria-label': t('delay') }),
                    h('span', { style: style.muted }, t('seconds')),
                    h('button', { type: 'button', style: { ...style.button, marginLeft: 'auto' },
                      disabled: !writable || !Number.isInteger(interval) || interval < 1 || interval > 3600 || interval === (values.timeoutSeconds ?? 120),
                      onClick: () => save('timeoutSeconds', interval) }, t('save')))))),
            scopeMode !== 'global' && h('details', { style: style.card },
              h('summary', { style: { ...style.spread, cursor: 'pointer', listStyle: 'none', fontSize: 14, fontWeight: 600 } },
                t('selectSessions'), h('span', { style: style.muted }, `${t('chosen')} ${draftIds.length} · ↓`)),
              h('fieldset', { disabled: !writable || !directoryReady, style: { border: 0, padding: 0, margin: '14px 0 0', display: 'grid', gap: 10 } },
                h('p', { style: { ...style.muted, margin: 0 } }, t(scopeMode === 'allowlist' ? 'emptyWhitelist' : 'emptyBlacklist')),
                !directoryReady && h('p', { role: 'status' }, t('directoryLoading')),
                h('label', { style: style.field }, t('search'), h('input', { type: 'search', value: query,
                  onChange: event => setQuery(event.target.value), placeholder: t('searchHint'), style: style.control })),
                h('label', { style: { ...style.row, ...style.muted } }, h('input', { type: 'checkbox', checked: showArchived,
                  onChange: event => setShowArchived(event.target.checked) }), t('archived')),
                h('div', { style: { maxHeight: 220, overflowY: 'auto', display: 'grid', gap: 5 } },
                  ...filtered.slice(0, 120).map(item => h('label', { key: item.id, style: { ...style.row, fontSize: 13 }, title: item.id },
                    h('input', { type: 'checkbox', value: item.id, checked: draftIds.includes(item.id),
                      onChange: event => setDraftIds(previous => event.target.checked
                        ? [...new Set([...previous, item.id])] : previous.filter(id => id !== item.id)) }),
                    item.title, item.archived ? ` (${t('archivedSuffix')})` : '', ` · ${item.id.slice(-8)}`)),
                  ...missing.slice(visibleMissingPage * 120, (visibleMissingPage + 1) * 120).map(id => h('label', { key: id, style: { ...style.row, fontSize: 13 }, title: id },
                    h('input', { type: 'checkbox', value: id, checked: true,
                      onChange: () => setDraftIds(previous => previous.filter(entry => entry !== id)) }),
                    `${t('missing')} · ${id}`)),
                  directoryReady && filtered.length === 0 && missing.length === 0 && h('p', { style: style.muted }, t('noMatches'))),
                filtered.length > 120 && h('p', { style: style.muted }, t('narrowSearch')),
                missing.length > 120 && h('div', { style: style.row },
                  h('button', { type: 'button', disabled: !writable || visibleMissingPage === 0, style: style.button,
                    onClick: () => setMissingPage(page => Math.max(0, page - 1)) }, t('previous')),
                  h('span', { style: style.muted }, `${visibleMissingPage + 1} / ${missingPages} ${t('page')}`),
                  h('button', { type: 'button', disabled: !writable || visibleMissingPage >= missingPages - 1, style: style.button,
                    onClick: () => setMissingPage(page => page + 1) }, t('next'))),
                h('button', { type: 'button', disabled: !writable || !directoryReady || !dirty, style: style.button,
                  onClick: () => save('sessionIds', [...draftIds]) }, t('saveSessions')))),
            h('details', { style: { padding: '2px 4px' } },
              h('summary', { style: { ...style.muted, cursor: 'pointer' } }, t('help')),
              h('div', { style: { ...style.muted, display: 'grid', gap: 6, padding: '10px 0 0 18px' } },
                h('div', null, t('helpOne')), h('div', null, t('helpTwo')), h('div', null, t('helpThree')))),
            error && h('p', { role: 'alert', style: { color: 'var(--dsw-alias-state-error-primary)' } }, t(error)),
            snapshot.status !== 'ready' && h('p', { role: 'status' }, `${t('configStatus')}: ${snapshot.status}`));
        }
        ctx.effect(() => ctx.configForms.whileServed(['dsh-auto-decide'], () =>
          ctx.slots.inject('plugins.row.config', () => ctx.slots.register({
            name: 'plugins.row.config', key: 'dsh-auto-decide#dsh-auto-decide', locale: ns,
          }, QuestionTimeoutSettings))), 'dsh-auto-decide: settings');
      },
    };
  },
});
