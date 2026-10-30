type DraftStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export type QuestionnaireDraft<T, V extends string> = { version: V; answers: T; page: number; completed: boolean; submitted?: boolean };

/** Each questionnaire keeps its own key and validation; storage failure handling is shared. */
export function createQuestionnaireDraftStore<T extends unknown[], V extends string>(
  getStorage: () => DraftStorage,
  config: { key: string; version: V; pages: number; validate: (value: unknown) => value is T },
) {
  type Draft = QuestionnaireDraft<T, V>;
  type Read = { kind: 'empty' | 'invalid' | 'unavailable' } | { kind: 'restored'; draft: Draft };
  return {
    read(): Read {
      let stored: string | null;
      try { stored = getStorage().getItem(config.key); } catch { return { kind: 'unavailable' }; }
      if (stored === null) return { kind: 'empty' };
      try {
        const value = JSON.parse(stored);
        if (!value || value.version !== config.version || !config.validate(value.answers)) return { kind: 'invalid' };
        const completed = value.answers.every((answer: unknown) => answer !== null);
        return { kind: 'restored', draft: { version: config.version, answers: value.answers,
          page: Number.isInteger(value.page) && value.page >= 0 && value.page < config.pages ? value.page : 0,
          completed, submitted: value.submitted === true && completed } };
      } catch { return { kind: 'invalid' }; }
    },
    save(draft: Draft): boolean {
      try { getStorage().setItem(config.key, JSON.stringify(draft)); return true; } catch { return false; }
    },
    clear(): boolean {
      try { getStorage().removeItem(config.key); return true; } catch { return false; }
    },
  };
}
