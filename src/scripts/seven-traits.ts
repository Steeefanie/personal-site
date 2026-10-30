import {
  isValidAnswer,
  questions, scoreAnswers, type Answers,
} from '../lib/seven-traits';
import { createDraftStore } from '../lib/seven-traits-draft';
import { renderReport } from './seven-traits-report';
import { createAiReportClient } from './seven-traits-ai';
import { downloadReport } from './questionnaire-download';

const app = document.querySelector<HTMLElement>('[data-st-app]');
if (app) initialize(app);

function initialize(app: HTMLElement) {
  const find = <T extends HTMLElement>(selector: string) => {
    const element = app.querySelector<T>(selector);
    if (!element) throw new Error(`Missing measurement UI: ${selector}`);
    return element;
  };
  const draftStore = createDraftStore(() => localStorage);
  const intro = find('[data-st-intro]');
  const quiz = find('[data-st-quiz]');
  const report = find('[data-st-report]');
  const submission = find('[data-st-submission]');
  const form = find<HTMLFormElement>('[data-st-form]');
  const error = find('[data-st-error]');
  const status = find('[data-st-storage]');
  const dialog = find<HTMLDialogElement>('[data-st-dialog]');
  const pageNodes = [...app.querySelectorAll<HTMLElement>('[data-st-question-page]')];
  let answers: Answers = Array(56).fill(null);
  let page = 0;
  let completed = false;
  let submitted = false;
  let submitting = false;
  let submissionRevision = 0;
  let saved = false;
  let storageAvailable = true;
  const count = () => answers.filter((value) => value !== null).length;

  const restored = draftStore.read();
  if (restored.kind === 'restored') {
    ({ answers, page, completed } = restored.draft);
    submitted = restored.draft.submitted === true;
    saved = true;
  } else if (restored.kind === 'invalid') {
    saved = true;
    status.textContent = '本地记录已损坏或版本不兼容，未恢复答案。可清除记录，或重新开始测评。';
    status.hidden = false;
  } else if (restored.kind === 'unavailable') {
    status.textContent = '无法读取本地记录。你仍可开始测评；若浏览器限制存储，关闭页面后进度可能丢失。';
    status.hidden = false;
    storageAvailable = false;
  }

  const aiControls = createAiReportClient(() => answers);

  if (aiControls.getReport()) submitted = true;
  form.querySelectorAll<HTMLInputElement>('input').forEach(input => { input.disabled = submitted; });

  function updateClearButtons() {
    const hasData = count() > 0 || (saved && restored.kind === 'invalid');
    app.querySelectorAll<HTMLButtonElement>('[data-st-clear]').forEach((button) => { button.hidden = !hasData; });
    updateProgress();
  }

  function save() {
    completed = count() === 56;
    if (draftStore.save({ version: '1.2', answers, page, completed, submitted })) {
      saved = true;
      storageAvailable = true;
      status.textContent = '';
      status.hidden = true;
    } else {
      storageAvailable = false;
      status.textContent = '本地暂存失败，当前仍可答题和生成报告。离开或刷新页面可能丢失本次进度。';
      status.hidden = false;
    }
    updateClearButtons();
  }

  function show(stage: 'intro' | 'quiz' | 'result' | 'submission') {
    app.dataset.stage = stage;
    intro.hidden = stage !== 'intro';
    quiz.hidden = stage !== 'quiz';
    report.hidden = stage !== 'result';
    submission.hidden = stage !== 'submission';
    find('[data-st-home]').hidden = stage !== 'result';
    find('[data-st-title]').hidden = stage === 'result';
    updateClearButtons();
    if (stage === 'intro') {
      find('[data-st-start]').textContent = submitted ? (aiControls.getReport() ? '查看测试结果' : '继续生成报告') : count() ? '继续测试' : '开始测试';
      const resume = find('[data-st-resume]');
      resume.hidden = count() === 0;
      resume.textContent = `已完成 ${count()} / 56 题${storageAvailable ? '' : ' · 尚未保存'}`;
    }
  }

  function moveFocus(element: HTMLElement) {
    element.focus({ preventScroll: true });
    element.scrollIntoView({ block: 'start', behavior: 'instant' });
  }

  function updateProgress() {
    find('[data-st-count]').textContent = `已答 ${count()} / 56`;
    find<HTMLProgressElement>('[data-st-progress]').value = count();
  }

  function returnHome() {
    if (count() > 0) save();
    show('intro');
    find<HTMLHeadingElement>('.st-header h1').tabIndex = -1;
    find<HTMLHeadingElement>('.st-header h1').focus({ preventScroll: true });
    app.scrollIntoView({ block: 'start', behavior: 'instant' });
  }

  async function submitAnswers() {
    if (submitting) return;
    const missing = answers.findIndex((value) => !isValidAnswer(value));
    if (missing !== -1) { page = Math.floor(missing / 8); showPage(); return; }
    submitted = true;
    save();
    form.querySelectorAll<HTMLInputElement>('input').forEach(input => { input.disabled = true; });
    if (aiControls.getReport()) { showReport(); return; }
    submitting = true;
    const requestRevision = ++submissionRevision;
    show('submission');
    submission.setAttribute('aria-busy', 'true');
    find('[data-st-spinner]').hidden = false;
    find('[data-st-retry]').hidden = true;
    find('[data-st-submission-home]').hidden = true;
    find('[data-st-submission-title]').textContent = '正在生成报告';
    find('[data-st-submission-status]').textContent = '正在逐题分析你的回答，请稍候。';
    moveFocus(find('[data-st-submission-title]'));
    try {
      await aiControls.generate();
      if (requestRevision === submissionRevision) showReport();
    } catch (error) {
      if (requestRevision !== submissionRevision) return;
      find('[data-st-submission-title]').textContent = '报告暂未生成';
      find('[data-st-submission-status]').textContent = error instanceof Error ? error.message : '生成失败，请重试。本次作答已保留。';
      find('[data-st-retry]').hidden = false;
      find('[data-st-submission-home]').hidden = false;
    } finally {
      if (requestRevision === submissionRevision) {
        submitting = false;
        submission.setAttribute('aria-busy', 'false');
        find('[data-st-spinner]').hidden = true;
      }
    }
  }

  function showPage(focus = true) {
    if (submitted) { void submitAnswers(); return; }
    show('quiz');
    pageNodes.forEach((node, index) => { node.hidden = index !== page; });
    find('[data-st-step]').textContent = `第 ${page + 1} / 7 轮`;
    find<HTMLButtonElement>('[data-st-previous]').disabled = page === 0;
    find('[data-st-next]').textContent = page === 6 ? '提交' : '下一轮 →';
    error.hidden = true;
    updateProgress();
    if (focus) {
      const heading = pageNodes[page].querySelector<HTMLElement>('h2')!;
      heading.focus({ preventScroll: true });
      quiz.scrollIntoView({ block: 'start', behavior: 'instant' });
    }
  }

  answers.forEach((answer, index) => {
    if (answer !== null) {
      const radio = form.querySelector<HTMLInputElement>(`input[name="q${index + 1}"][value="${answer}"]`);
      if (radio) radio.checked = true;
    }
  });
  show('intro');
  find('[data-st-start]').addEventListener('click', () => {
    if (submitted) void submitAnswers();
    else { showPage(); save(); }
  });
  find('[data-st-retry]').addEventListener('click', () => void submitAnswers());
  find('[data-st-submission-home]').addEventListener('click', returnHome);
  find('[data-st-home]').addEventListener('click', (event) => { event.preventDefault(); returnHome(); });
  form.addEventListener('change', (event) => {
    if (submitted) return;
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.type !== 'radio' || !/^q\d+$/.test(input.name)) return;
    const index = Number(input.name.slice(1)) - 1;
    const value = Number(input.value);
    if (!isValidAnswer(value)) return;
    if (answers[index] !== value) aiControls.invalidate();
    answers[index] = value;
    input.closest('fieldset')?.removeAttribute('data-unanswered');
    error.hidden = true;
    updateProgress();
    save();
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (submitted) return;
    const missing = Array.from({ length: 8 }, (_, offset) => page * 8 + offset).filter((index) => !isValidAnswer(answers[index]));
    if (missing.length) {
      error.textContent = `本页还有 ${missing.length} 题未作答，请先完成第 ${missing.map((index) => index + 1).join('、')} 题。`;
      error.hidden = false;
      missing.forEach((index) => find(`[data-st-question="${index + 1}"]`).setAttribute('data-unanswered', ''));
      moveFocus(find<HTMLInputElement>(`[name="q${missing[0] + 1}"]`));
      return;
    }
    if (page < 6) { page++; save(); showPage(); return; }
    void submitAnswers();
  });
  find('[data-st-previous]').addEventListener('click', () => { if (!submitted && page > 0) { page--; save(); showPage(); } });
  find('[data-st-pause]').addEventListener('click', returnHome);
  find('[data-st-pdf]').addEventListener('click', async () => {
    const button = find<HTMLButtonElement>('[data-st-pdf]');
    const exportStatus = find('[data-st-export-status]');
    button.disabled = true;
    button.textContent = '正在生成…';
    exportStatus.hidden = true;
    try {
      const snapshot = [...answers];
      const snapshotAi = aiControls.getReport();
      const { createReportPdf } = await import('../lib/seven-traits-pdf');
      if (!snapshotAi) throw new Error('报告暂未生成，请稍后重试。');
      const blob = await createReportPdf(snapshot, snapshotAi);
      if (JSON.stringify(snapshot) !== JSON.stringify(answers) || snapshotAi !== aiControls.getReport()) return;
      const reportDate = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai' }).format(new Date());
      downloadReport(blob, `七宗罪与七美德报告-${reportDate}.pdf`);
    } catch (error) {
      exportStatus.textContent = error instanceof Error ? error.message : '报告生成失败，请重试。';
      exportStatus.hidden = false;
    } finally {
      button.disabled = false;
      button.textContent = '保存报告';
    }
  });
  app.querySelectorAll('[data-st-clear]').forEach((button) => button.addEventListener('click', () => dialog.showModal()));
  find('[data-st-cancel]').addEventListener('click', () => dialog.close());
  find('[data-st-confirm]').addEventListener('click', () => {
    const cleared = draftStore.clear();
    const aiCleared = aiControls.invalidate();
    if (cleared && aiCleared) {
      status.textContent = '';
    } else {
      // Do not claim persistent data was erased when browser storage cannot be accessed.
      status.textContent = '页面中的答案已清空，但无法确认本地存储已删除。请通过浏览器的网站数据设置清除此站点记录。';
    }
    status.hidden = status.textContent === '';
    answers = Array(56).fill(null);
    page = 0;
    completed = false;
    submitted = false;
    submitting = false;
    submissionRevision++;
    form.querySelectorAll<HTMLInputElement>('input').forEach(input => { input.disabled = false; });
    saved = false;
    form.reset();
    app.querySelectorAll('[data-unanswered]').forEach((node) => node.removeAttribute('data-unanswered'));
    find('[data-st-result]').replaceChildren();
    find('[data-st-answer-review]').replaceChildren();
    find<HTMLDetailsElement>('.st-answer-review').open = false;
    find('[data-st-export-status]').hidden = true;
    dialog.close();
    returnHome();
  });

  function node<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, className?: string) {
    const element = document.createElement(tag);
    if (text !== undefined) element.textContent = text;
    if (className) element.className = className;
    return element;
  }

  function showReport() {
    const result = scoreAnswers(answers);
    const heading = renderReport(find('[data-st-result]'), result, aiControls.getReport()!);

    const review = find('[data-st-answer-review]');
    review.replaceChildren();
    questions.forEach((question) => {
      const item = node('li'), content = node('div', undefined, 'fe-review-content');
      content.append(node('span', question.text));
      const response = node('span', undefined, 'fe-review-response');
      response.append(node('span', '→', 'fe-review-arrow'), node('span', `${answers[question.id - 1]} 分`));
      content.append(response); item.append(node('span', `${question.id}.`, 'fe-review-number'), content); review.append(item);
    });
    show('result');
    heading.focus({ preventScroll: true });
    app.scrollIntoView({ block: 'start', behavior: 'instant' });
  }
}
