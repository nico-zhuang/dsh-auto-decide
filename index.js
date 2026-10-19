import z from '@deepseek-ai/schemastery';
import { registerQuestionTimeout } from './runtime.js';

export const name = 'dsh-auto-decide';
export const inject = ['tools', 'userQuestions'];
export const Config = z.object({
  enabled: z.boolean().default(true).volatile().description('启用普通提问超时处理；不处理计划审阅和安全审批'),
  mode: z.union(['skip', 'recommended']).default('skip').volatile().description('默认跳过；推荐模式仅对展示／格式类普通问题选择唯一标注 Recommended 的选项，其余跳过'),
  timeoutSeconds: z.number().step(1).min(1).max(3600).default(120).volatile().description('独立计时：普通问题发出后多少秒自动处理（1–3600）'),
  scopeMode: z.union(['global', 'allowlist', 'blocklist']).default('global').volatile().description('全局、仅指定会话或排除指定会话；默认兼容旧版全局模式'),
  sessionIds: z.array(z.string()).default([]).volatile().description('作用域名单中的稳定会话 ID；白名单留空时不自动处理任何会话'),
});

export function apply(ctx, config) {
  ctx.effect(() => registerQuestionTimeout(ctx, config), 'dsh-auto-decide: automation');
}
