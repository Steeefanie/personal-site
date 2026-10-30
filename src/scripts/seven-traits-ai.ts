import { validateAiReport } from '../lib/seven-traits-ai.ts';
import { isDraftAnswers, isValidAnswer, type Answers } from '../lib/seven-traits.ts';
import { createQuestionnaireAiClient } from './questionnaire-ai.ts';
export const createAiReportClient = (getAnswers: () => Answers) => {
  for (const key of ['seven-traits-ai-v1.2', 'seven-traits-ai-v2']) {
    try { localStorage.removeItem(key); } catch { /* Report migration never changes answers or blocks use. */ }
  }
  return createQuestionnaireAiClient(getAnswers, {
  storageKey: 'seven-traits-ai-v3', endpoint: '/api/v1/seven-traits/report', validate: validateAiReport,
  isComplete: answers => isDraftAnswers(answers) && answers.every(isValidAnswer),
  });
};
