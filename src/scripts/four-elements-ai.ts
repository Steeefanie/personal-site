import { validateAiReport, validateGeneratedAiReport } from '../lib/four-elements-ai.ts';
import { isDraftAnswers, isValidAnswer, type Answers } from '../lib/four-elements.ts';
import { createQuestionnaireAiClient } from './questionnaire-ai.ts';
export const createAiReportClient = (getAnswers: () => Answers) => {
  const client = createQuestionnaireAiClient(getAnswers, {
    storageKey: 'four-elements-ai-v1', endpoint: '/api/v1/four-elements/report',
    validate: value => validateAiReport(value, getAnswers()),
    validateGenerated: value => validateGeneratedAiReport(value, getAnswers()),
    isComplete: answers => isDraftAnswers(answers) && answers.every((value, index) => isValidAnswer(index, value)),
  });
  // A completed report is read-only. A new generation requires clearing it first.
  return { ...client, generate: () => {
    const report = client.getReport();
    return report ? Promise.resolve(report) : client.generate();
  } };
};
