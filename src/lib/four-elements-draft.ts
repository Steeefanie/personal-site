import { isDraftAnswers, type Answers } from './four-elements.ts';
import { createQuestionnaireDraftStore, type QuestionnaireDraft } from './questionnaire-draft.ts';
export const draftStorageKey = 'four-elements-v1';
export type Draft = QuestionnaireDraft<Answers, '1.0'>;
export const createDraftStore = (getStorage: () => Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>) =>
  createQuestionnaireDraftStore<Answers, '1.0'>(getStorage, { key: draftStorageKey, version: '1.0', pages: 8, validate: isDraftAnswers });
