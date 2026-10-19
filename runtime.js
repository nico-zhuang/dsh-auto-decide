import { AsyncLocalStorage } from 'node:async_hooks';
import { answerFor, settingsOf } from './policy.js';

const activeTool = new AsyncLocalStorage();

function isNoProvider(error) {
  return error?.code === 'NO_PROVIDER';
}

function waitForAbort(signal, kind) {
  if (!signal) return { promise: new Promise(() => {}), dispose() {} };
  let listener;
  const promise = new Promise(resolve => {
    listener = () => resolve({ kind });
    if (signal.aborted) listener();
    else signal.addEventListener('abort', listener, { once: true });
  });
  return { promise, dispose: () => signal.removeEventListener('abort', listener) };
}

/** Race a live human answer against a plugin-owned delay. The downstream UI
 * still starts immediately. Aborting the forwarded signal only after our answer
 * wins stops a stale UI from submitting to a settled waterfall. */
export async function autoAnswer(request, next, settings, options = {}) {
  const { config, agent, shutdownSignal, onAuto = () => {}, onError = () => {} } = options;
  const previousSignal = request.signal;
  const forwarded = new AbortController();
  request.signal = previousSignal ? AbortSignal.any([previousSignal, forwarded.signal]) : forwarded.signal;
  const parentAbort = waitForAbort(previousSignal, 'parent-abort');
  const shutdownAbort = waitForAbort(shutdownSignal, 'shutdown');
  let clock;
  const timeout = new Promise(resolve => { clock = setTimeout(() => resolve({ kind: 'timeout' }), settings.timeoutSeconds * 1000); });
  const human = Promise.resolve().then(() => next()).then(
    value => ({ kind: 'human', value }),
    error => ({ kind: 'error', error }),
  );
  try {
    let winner = await Promise.race([human, timeout, parentAbort.promise, shutdownAbort.promise]);
    if (winner.kind === 'error' && isNoProvider(winner.error)) {
      // With no connected UI, the Host can still supply the configured timeout.
      winner = await Promise.race([timeout, parentAbort.promise, shutdownAbort.promise]);
    }
    if (winner.kind === 'human') return winner.value;
    if (winner.kind === 'error') throw winner.error;
    if (winner.kind !== 'timeout') {
      const settled = await human;
      if (settled.kind === 'error') throw settled.error;
      return settled.value;
    }
    // Live edits to the settings do not authorize an old pending decision.
    const current = settingsOf(config);
    if (!current.enabled || current.mode !== settings.mode || current.timeoutSeconds !== settings.timeoutSeconds) {
      const settled = await human;
      if (settled.kind === 'error') throw settled.error;
      return settled.value;
    }
    const batch = answerFor(request, current.mode) ?? answerFor(request, 'skip');
    if (batch === null || previousSignal?.aborted || shutdownSignal?.aborted) {
      const settled = await human;
      if (settled.kind === 'error') throw settled.error;
      return settled.value;
    }
    // The context is plugin-authored; it must never masquerade as human consent.
    const note = {
      origin: 'dsh-auto-decide', humanConfirmed: false,
      mode: current.mode, outcome: batch.answers.every(answer => answer.selected.length === 0) ? 'skipped' : 'selected',
      questions: request.questions.map(q => ({ id: q.id, question: q.question, options: q.options ?? [] })),
      answers: batch.answers,
      notice: '自动处理而非用户本人确认；跳过不是同意。不能据此授权发布、部署、删除、付款或权限变更。',
    };
    try {
      agent.inject({ source: { kind: 'dsh-auto-decide' }, content: [{ type: 'text', text: JSON.stringify(note) }] });
    } catch (error) {
      try { onError(error); } catch { /* telemetry must not replace the original failure */ }
      const settled = await human;
      if (settled.kind === 'error') throw settled.error;
      return settled.value;
    }
    // Telemetry is not part of the decision: once context was injected, a
    // logger failure cannot silently swap this answer for a human/no-provider result.
    try { onAuto(note); } catch (error) {
      try { onError(error); } catch { /* keep the established decision */ }
    }
    forwarded.abort(new Error('question settled by configured automation'));
    return batch;
  } finally {
    clearTimeout(clock);
    parentAbort.dispose();
    shutdownAbort.dispose();
    request.signal = previousSignal;
  }
}

/** Register against the host's scoped waterfall, but accept only requests
 * arising inside the exact model-facing ask_user_question tool execution. */
export function registerQuestionTimeout(ctx, config) {
  const shutdown = new AbortController();
  const stops = [];
  stops.push(ctx.on('tools/execute', (exec, next) => {
    if (exec.name !== 'ask_user_question' || !exec.agent) return next();
    return activeTool.run({ agent: exec.agent }, next);
  }, { global: true, prepend: true }));
  stops.push(ctx.on('user-questions/request', (request, next) => {
    const scope = activeTool.getStore();
    if (!scope || !request.agent || scope.agent !== request.agent || request.questions?.some(q => q.intent !== undefined || q.detail !== undefined)) return next();
    const settings = settingsOf(config);
    if (!settings.enabled) return next();
    return autoAnswer(request, next, settings, {
      config, agent: request.agent, shutdownSignal: shutdown.signal,
      onAuto: note => ctx.logger.info(`[question-timeout] auto ${note.outcome}; question ids=${note.questions.map(q => q.id).join(',')}`),
      onError: error => ctx.logger.warn(`[question-timeout] context injection failed: ${String(error)}`),
    });
  }, { global: true, prepend: true }));
  return () => {
    shutdown.abort();
    for (const stop of stops.reverse()) stop?.();
  };
}
