window.__ModuleLoader__.load({
  id: 'dsh-auto-decide',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const palette = { box: { padding: 20, maxWidth: 620, display: 'grid', gap: 14 },
      muted: { opacity: 0.72, fontSize: 13, lineHeight: 1.55 },
      row: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
      control: { padding: '8px 12px', borderRadius: 8, border: '1px solid var(--dsw-alias-border-primary, #999)', background: 'var(--dsw-alias-surface-primary, transparent)', color: 'inherit' } };
    return {
      inject: ['slots', 'configForms', 'sessions', 'workspaces'],
      apply(ctx) {
        const form = ctx.configForms.get('dsh-auto-decide');
        const sessionsStore = ctx.sessions.list;
        const workspacesStore = ctx.workspaces.list;
        function QuestionTimeoutSettings({ view }) {
          const snapshot = React.useSyncExternalStore(
            React.useCallback(listener => form.subscribe(listener), []),
            React.useCallback(() => form.getSnapshot(), []),
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
              if (!await form.set(field, value)) setError('保存失败：配置可能已被修改，请重新加载后再试。');
            } catch (cause) { setError(String(cause?.message ?? cause)); }
            finally { setBusy(false); }
          }
          const writable = snapshot.status === 'ready' && snapshot.writable && !busy;
          const interval = Number(seconds);
          const scopeMode = values.scopeMode ?? 'global';
          const scopeLabel = { global: '全局', allowlist: '白名单', blocklist: '黑名单' }[scopeMode] ?? '全局';
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
          if (view === 'summary') return h('span', null, `普通提问 · ${scopeLabel} · ${values.timeoutSeconds ?? 120} 秒 · ${values.mode === 'recommended' ? '推荐项' : '跳过'}`);
          return h('section', { style: palette.box, 'aria-label': 'dsh-auto-decide 提问自动处理' },
            h('h2', { style: { margin: 0, fontSize: 18 } }, 'dsh-auto-decide · 提问自动处理'),
            h('p', { style: palette.muted }, '仅适用于普通 ask_user_question。不会自动处理安全审批或方案审阅；插件给出的答案会在上下文标为自动处理，而不是用户亲自同意。'),
            h('label', { style: palette.row }, h('input', { type: 'checkbox', checked: values.enabled ?? true, disabled: !writable,
              onChange: event => save('enabled', event.target.checked) }), '启用自动处理'),
            h('label', { style: palette.row }, '工作范围', h('select', { value: scopeMode, disabled: !writable,
              onChange: event => save('scopeMode', event.target.value), style: palette.control },
              h('option', { value: 'global' }, '全局：所有会话'),
              h('option', { value: 'allowlist' }, '白名单：仅选中会话'),
              h('option', { value: 'blocklist' }, '黑名单：排除选中会话'))),
            scopeMode !== 'global' && h('fieldset', { disabled: !writable || !directoryReady,
              style: { border: '1px solid var(--dsw-alias-border-primary, #999)', borderRadius: 8, display: 'grid', gap: 10 } },
              h('legend', null, `${scopeLabel} · 已选 ${draftIds.length} 个会话`),
              h('p', { style: palette.muted }, scopeMode === 'allowlist'
                ? '只在选中会话自动处理；新会话默认不在名单中。空名单等于全部保持人工回答。'
                : '选中会话保持人工回答；新会话默认会自动处理，请留意重要会话。空名单等于全局模式。'),
              !directoryReady && h('p', { role: 'status' }, '会话目录加载中；加载完成后才能编辑名单。'),
              h('label', { style: palette.row }, '搜索会话', h('input', { type: 'search', value: query,
                onChange: event => setQuery(event.target.value), placeholder: '按标题或会话 ID 筛选', style: palette.control })),
              h('label', { style: palette.row }, h('input', { type: 'checkbox', checked: showArchived,
                onChange: event => setShowArchived(event.target.checked) }), '显示已归档会话'),
              h('div', { style: { maxHeight: 240, overflowY: 'auto', display: 'grid', gap: 5 } },
                ...filtered.slice(0, 120).map(item => h('label', { key: item.id, style: palette.row, title: item.id },
                  h('input', { type: 'checkbox', value: item.id, checked: draftIds.includes(item.id),
                    onChange: event => setDraftIds(previous => event.target.checked
                      ? [...new Set([...previous, item.id])] : previous.filter(id => id !== item.id)) }),
                  item.title, item.archived ? '（已归档）' : '', ` · ${item.id.slice(-8)}`)),
                ...missing.slice(visibleMissingPage * 120, (visibleMissingPage + 1) * 120).map(id => h('label', { key: id, style: palette.row, title: id },
                  h('input', { type: 'checkbox', value: id, checked: true,
                    onChange: () => setDraftIds(previous => previous.filter(entry => entry !== id)) }),
                  `已选但目录未显示 · ${id}`)),
                directoryReady && filtered.length === 0 && missing.length === 0 && h('p', { style: palette.muted }, '没有匹配的会话。')),
              filtered.length > 120 && h('p', { style: palette.muted }, '目录仅显示前 120 条，请输入标题或会话 ID 缩小范围。'),
              missing.length > 120 && h('div', { style: palette.row },
                h('button', { type: 'button', disabled: !writable || visibleMissingPage === 0,
                  onClick: () => setMissingPage(page => Math.max(0, page - 1)), style: palette.control }, '上一页'),
                `目录外已选 ${visibleMissingPage + 1} / ${missingPages} 页`,
                h('button', { type: 'button', disabled: !writable || visibleMissingPage >= missingPages - 1,
                  onClick: () => setMissingPage(page => page + 1), style: palette.control }, '下一页')),
              h('button', { type: 'button', disabled: !writable || !directoryReady || !dirty,
                onClick: () => save('sessionIds', [...draftIds]), style: palette.control }, '保存已选会话')),
            scopeMode === 'global' && h('p', { style: palette.muted }, '全局模式保留名单但不使用；切回白名单或黑名单时名单会恢复。'),
            h('label', { style: palette.row }, '超时处理方式', h('select', { value: values.mode ?? 'skip', disabled: !writable,
              onChange: event => save('mode', event.target.value), style: palette.control },
              h('option', { value: 'skip' }, '跳过（默认）'),
              h('option', { value: 'recommended' }, '仅展示或格式类问题选唯一推荐项；否则跳过'))),
            h('label', { style: palette.row }, '等待秒数', h('input', { type: 'number', min: 1, max: 3600, step: 1,
              value: seconds, disabled: !writable, onChange: event => setSeconds(event.target.value), style: { ...palette.control, width: 100 } }),
              h('button', { type: 'button', style: palette.control, disabled: !writable || !Number.isInteger(interval) || interval < 1 || interval > 3600,
                onClick: () => save('timeoutSeconds', interval) }, '保存秒数')),
            h('div', { style: palette.muted }, '可设置 5 秒、120 秒等。新问题使用最新配置；等待中的问题若配置被更改，将不自动处理。页面隐藏时由 Host 继续计时。'),
            h('div', { style: palette.muted }, '推荐只用于题干与选中选项均明确属于展示／格式类的单选题，且选项末尾标注 (Recommended)；其余及敏感词均改为跳过。不构成任何操作授权。'),
            error && h('p', { role: 'alert' }, error),
            snapshot.status !== 'ready' && h('p', { role: 'status' }, `配置状态：${snapshot.status}`));
        }
        ctx.effect(() => ctx.configForms.whileServed(['dsh-auto-decide'], () =>
          ctx.slots.inject('plugins.row.config', () => ctx.slots.register({
            name: 'plugins.row.config', key: 'dsh-auto-decide#dsh-auto-decide',
          }, QuestionTimeoutSettings))), 'dsh-auto-decide: settings');
      },
    };
  },
});
