import { isDraftAnswers, type Answers } from './seven-traits.ts';
import { createQuestionnaireDraftStore } from './questionnaire-draft.ts';
export const draftStorageKey = 'seven-traits-v1.2';
export const createDraftStore = (getStorage: () => Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>) =>
  createQuestionnaireDraftStore<Answers, '1.2'>(getStorage, { key: draftStorageKey, version: '1.2', pages: 7, validate: isDraftAnswers });
