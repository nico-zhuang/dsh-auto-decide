window.__ModuleLoader__.load({
  id: 'auto-decide',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const palette = { box: { padding: 20, maxWidth: 620, display: 'grid', gap: 14 },
      muted: { opacity: 0.72, fontSize: 13, lineHeight: 1.55 },
      row: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
      control: { padding: '8px 12px', borderRadius: 8, border: '1px solid var(--dsw-alias-border-primary, #999)', background: 'var(--dsw-alias-surface-primary, transparent)', color: 'inherit' } };
    return {
      inject: ['slots', 'configForms'],
      apply(ctx) {
        const form = ctx.configForms.get('auto-decide');
        function QuestionTimeoutSettings({ view }) {
          const snapshot = React.useSyncExternalStore(
            React.useCallback(listener => form.subscribe(listener), []),
            React.useCallback(() => form.getSnapshot(), []),
          );
          const values = snapshot.value || {};
          const [seconds, setSeconds] = React.useState(String(values.timeoutSeconds ?? 120));
          const [busy, setBusy] = React.useState(false);
          const [error, setError] = React.useState('');
          React.useEffect(() => setSeconds(String(values.timeoutSeconds ?? 120)), [values.timeoutSeconds]);
          async function save(field, value) {
            setBusy(true); setError('');
            try {
              if (!await form.set(field, value)) setError('保存失败：配置可能已被修改，请重新加载后再试。');
            } catch (cause) { setError(String(cause?.message ?? cause)); }
            finally { setBusy(false); }
          }
          const writable = snapshot.status === 'ready' && snapshot.writable && !busy;
          const interval = Number(seconds);
          if (view === 'summary') return h('span', null, `普通提问 · ${values.timeoutSeconds ?? 120} 秒 · ${values.mode === 'recommended' ? '推荐项' : '跳过'}`);
          return h('section', { style: palette.box, 'aria-label': 'auto-decide 提问自动处理' },
            h('h2', { style: { margin: 0, fontSize: 18 } }, 'auto-decide · 提问自动处理'),
            h('p', { style: palette.muted }, '仅适用于普通 ask_user_question。不会自动处理安全审批或方案审阅；插件给出的答案会在上下文标为自动处理，而不是用户亲自同意。'),
            h('label', { style: palette.row }, h('input', { type: 'checkbox', checked: values.enabled ?? true, disabled: !writable,
              onChange: event => save('enabled', event.target.checked) }), '启用自动处理'),
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
        ctx.effect(() => ctx.configForms.whileServed(['auto-decide'], () =>
          ctx.slots.inject('plugins.row.config', () => ctx.slots.register({
            name: 'plugins.row.config', key: 'auto-decide#auto-decide',
          }, QuestionTimeoutSettings))), 'auto-decide: settings');
      },
    };
  },
});
