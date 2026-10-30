const answerKey = (answers: unknown[]) => JSON.stringify(answers);
export function createQuestionnaireAiClient<A extends unknown[], R>(getAnswers: () => A, config: { storageKey: string; endpoint: string; validate: (value: unknown) => R; validateGenerated?: (value: unknown) => R; isComplete: (answers: A) => boolean }) {
  let current: { answersKey: string; report: R; model: string; generatedAt: string } | undefined, controller: AbortController | undefined, revision = 0;
  try {
    const stored = JSON.parse(localStorage.getItem(config.storageKey) || 'null');
    if (config.isComplete(getAnswers()) && stored?.answersKey === answerKey(getAnswers()) && typeof stored.model === 'string' && typeof stored.generatedAt === 'string') {
      current = { ...stored, report: config.validate(stored.report) };
    }
  } catch { /* A damaged or inaccessible AI cache never blocks the questionnaire. */ }
  const generate = async () => {
    if (!config.isComplete(getAnswers())) throw new Error('请先完成全部题目后再提交。');
    const answers = [...getAnswers()], key = answerKey(answers), requestRevision = ++revision;
    controller?.abort(); controller = new AbortController();
    try {
      const response = await fetch(config.endpoint, { method: 'POST',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answers, consent: true }),
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(105000)]) });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(typeof data?.error === 'string' ? data.error
        : response.status === 404 ? '当前页面未连接到报告接口（HTTP 404）。请刷新页面后重试。'
        : `报告服务连接失败（HTTP ${response.status}），请稍后重试。本次作答已保留。`);
      if (!data || typeof data !== 'object') throw new Error('报告接口返回内容异常，请刷新页面后重试。本次作答已保留。');
      const report = (config.validateGenerated ?? config.validate)(data.report);
      if (typeof data.model !== 'string' || typeof data.generatedAt !== 'string') throw new Error('AI 服务返回的信息不完整，请重试。');
      if (requestRevision !== revision || key !== answerKey(getAnswers())) throw new DOMException('Request cancelled', 'AbortError');
      current = { answersKey: key, report, model: data.model, generatedAt: data.generatedAt };
      try { localStorage.setItem(config.storageKey, JSON.stringify(current)); } catch { /* Keep the report in memory for export. */ }
      return report;
    } catch (error) {
      if (requestRevision !== revision) throw new DOMException('Request cancelled', 'AbortError');
      throw new Error(error instanceof Error && error.name === 'TimeoutError' ? '生成用时较长，请稍后重试。本次作答已保留。'
        : error instanceof Error && error.name !== 'TypeError' ? error.message : '无法连接 AI 服务，请稍后重试。本次作答已保留。');
    }
  };
  return {
    generate,
    getReport: () => config.isComplete(getAnswers()) && current?.answersKey === answerKey(getAnswers()) ? current.report : undefined,
    invalidate() {
      revision++; controller?.abort(); current = undefined;
      try { localStorage.removeItem(config.storageKey); return true; } catch { return false; }
    },
  };
}
