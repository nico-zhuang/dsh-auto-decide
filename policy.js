// A question may be answered by this plugin only when it came from the
// model-facing ask_user_question tool. Callers decide that provenance; this
// module deals with the content and with deterministic option selection.
const RECOMMENDED = /\s*\(Recommended\)\s*$/i;
// Recommendation is intentionally narrower than a general AI decision: both
// the question and its unique marked answer must concern presentation/format.
// This is still a heuristic, NOT an authorization or semantic safety boundary.
const PRESENTATION = /(?:预览|显示|展示|外观|样式|排版|格式|布局|配色|字号|字体|主题|阅读|措辞|文案|语言|中文|英文|preview|display|view|appearance|style|format|layout|font|theme|wording|language|english|chinese)/i;
// False positives skip the question; unknown high-risk wording remains possible.
const SENSITIVE = /(?:部署|上线|发布|公开|上传|覆盖|删除|清理|清空|抹除|销毁|付款|支付|购买|采购|授权|允许|许可|批准|同意|签署|确认|接受|共享|发送|提交|外发|第三方|隐私|客户|通讯录|数据库|生产库|门禁|账户|密码|密钥|转账|汇款|移交|转移|传给|贴到|写入|保存|更改|修改|更新|运行|执行|安装|卸载|推送|同步|恢复|重置|创建|收集|deploy|publish|upload|overwrite|delete|remove|clear|erase|pay|purchase|authorize|grant\s+access|approve|consent|agree|allow|accept|confirm|send|share|submit|forward|external|third.party|customer|credential|secret|password|database|production|execute|run\s|write|modify|install|uninstall|push|merge)/i;

export function settingsOf(config) {
  const enabled = config.enabled?.get?.() ?? config.enabled ?? true;
  const mode = config.mode?.get?.() ?? config.mode ?? 'skip';
  const timeoutSeconds = config.timeoutSeconds?.get?.() ?? config.timeoutSeconds ?? 120;
  const scopeMode = config.scopeMode?.get?.() ?? config.scopeMode ?? 'global';
  const rawIds = config.sessionIds?.get?.() ?? config.sessionIds ?? [];
  if (typeof enabled !== 'boolean') throw new TypeError('enabled must be boolean');
  if (!['skip', 'recommended'].includes(mode)) throw new TypeError('mode must be skip or recommended');
  if (!Number.isInteger(timeoutSeconds) || timeoutSeconds < 1 || timeoutSeconds > 3600) {
    throw new RangeError('timeoutSeconds must be an integer between 1 and 3600');
  }
  if (!['global', 'allowlist', 'blocklist'].includes(scopeMode)) throw new TypeError('invalid session scope mode');
  if (!Array.isArray(rawIds) || rawIds.length > 5000 || rawIds.some(id => typeof id !== 'string' || !id.trim()) || new Set(rawIds).size !== rawIds.length) {
    throw new TypeError('sessionIds must contain at most 5000 distinct nonempty session IDs');
  }
  return { enabled, mode, timeoutSeconds, scopeMode, sessionIds: [...rawIds] };
}

export function matchesSession(settings, sessionId) {
  if (settings.scopeMode === 'global') return true;
  if (typeof sessionId !== 'string' || !sessionId) return false;
  const listed = settings.sessionIds.includes(sessionId);
  return settings.scopeMode === 'allowlist' ? listed : !listed;
}

export function sameSessionScope(left, right) {
  // Older callers of the exported autoAnswer() may not have scope fields.
  const leftMode = left.scopeMode ?? 'global';
  const rightMode = right.scopeMode ?? 'global';
  const leftIds = left.sessionIds ?? [];
  const rightIds = right.sessionIds ?? [];
  return leftMode === rightMode && leftIds.length === rightIds.length
    && leftIds.every((id, index) => id === rightIds[index]);
}

export function answerFor(request, mode) {
  if (!request || !Array.isArray(request.questions) || request.questions.length === 0) return null;
  const ids = new Set();
  for (const question of request.questions) {
    if (!question || typeof question.id !== 'string' || !question.id || ids.has(question.id)) return null;
    ids.add(question.id);
    // These are service callers' review/approval intents, not plain tool questions.
    if (question.intent !== undefined || question.detail !== undefined) return null;
  }
  const answers = request.questions.map((question) => {
    if (mode === 'skip') return { id: question.id, selected: [] };
    if (question.multiSelect === true || !Array.isArray(question.options)) return null;
    const matches = question.options.filter(o => typeof o?.label === 'string' && RECOMMENDED.test(o.label));
    if (matches.length !== 1) return null;
    const context = [question.question, question.header].filter(value => typeof value === 'string').join(' ');
    const label = matches[0].label.replace(RECOMMENDED, '').trim();
    if (!PRESENTATION.test(context) || !PRESENTATION.test(label)) return null;
    const allText = [context, ...question.options.flatMap(o => [o?.label, o?.description])].filter(value => typeof value === 'string').join(' ');
    if (SENSITIVE.test(allText)) return null;
    return { id: question.id, selected: [matches[0].label] };
  });
  // A batch must be settled completely. No partial recommendation or guessed first item.
  if (answers.some(answer => answer === null)) return null;
  return { answers };
}
