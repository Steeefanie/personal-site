import { validateAiReport } from '../lib/four-elements-ai.ts';
import { isDraftAnswers, isValidAnswer, type Answers } from '../lib/four-elements.ts';
import { createQuestionnaireAiClient } from './questionnaire-ai.ts';
export const createAiReportClient = (getAnswers: () => Answers) => createQuestionnaireAiClient(getAnswers, {
  storageKey: 'four-elements-ai-v1', endpoint: '/api/v1/four-elements/report', validate: validateAiReport,
  isComplete: answers => isDraftAnswers(answers) && answers.every((value, index) => isValidAnswer(index, value)),
});
