import z from '@deepseek-ai/schemastery';
import { registerQuestionTimeout } from './runtime.js';

export const name = 'auto-decide';
export const inject = ['tools', 'userQuestions'];
export const Config = z.object({
  enabled: z.boolean().default(true).volatile().description('启用普通提问超时处理；不处理计划审阅和安全审批'),
  mode: z.union(['skip', 'recommended']).default('skip').volatile().description('默认跳过；推荐模式仅对展示／格式类普通问题选择唯一标注 Recommended 的选项，其余跳过'),
  timeoutSeconds: z.number().step(1).min(1).max(3600).default(120).volatile().description('独立计时：普通问题发出后多少秒自动处理（1–3600）'),
});

export function apply(ctx, config) {
  ctx.effect(() => registerQuestionTimeout(ctx, config), 'auto-decide: automation');
}
