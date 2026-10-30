import {
  isValidAnswer,
  scoreAnswers, type Answers,
} from '../lib/four-elements';
import { createDraftStore } from '../lib/four-elements-draft';
import { renderNarrativeReport } from './four-elements-report';
import { createAiReportClient } from './four-elements-ai';
import { downloadReport } from './questionnaire-download';

const app = document.querySelector<HTMLElement>('[data-fe-app]');
if (app) initialize(app);

function initialize(app: HTMLElement) {
  const find = <T extends HTMLElement>(selector: string) => {
    const element = app.querySelector<T>(selector);
    if (!element) throw new Error(`Missing measurement UI: ${selector}`);
    return element;
  };
  const draftStore = createDraftStore(() => localStorage);
  const intro = find('[data-fe-intro]');
  const quiz = find('[data-fe-quiz]');
  const report = find('[data-fe-report]');
  const submission = find('[data-fe-submission]');
  const form = find<HTMLFormElement>('[data-fe-form]');
  const error = find('[data-fe-error]');
  const status = find('[data-fe-storage]');
  const dialog = find<HTMLDialogElement>('[data-fe-clear-dialog]');
  const pageNodes = [...app.querySelectorAll<HTMLElement>('[data-fe-question-page]')];
  let answers: Answers = Array(48).fill(null);
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

  function updateClearButtons() {
    const hasData = count() > 0 || (saved && restored.kind === 'invalid');
    app.querySelectorAll<HTMLButtonElement>('[data-fe-clear]').forEach((button) => { button.hidden = !hasData; });
    updateProgress();
  }

  function save() {
    completed = count() === 48;
    if (draftStore.save({ version: '1.0', answers, page, completed, submitted })) {
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
    find('[data-fe-home]').hidden = stage !== 'result';
    find('[data-fe-title]').hidden = stage === 'result';
    updateClearButtons();
    if (stage === 'intro') {
      find('[data-fe-start]').textContent = submitted ? (aiControls.getReport() ? '查看测试结果' : '继续生成报告') : count() ? '继续测试' : '开始测试';
      const resume = find('[data-fe-resume]');
      resume.hidden = count() === 0;
      resume.textContent = `已完成 ${count()} / 48 题${storageAvailable ? '' : ' · 尚未保存'}`;
    }
  }

  function moveFocus(element: HTMLElement) {
    element.focus({ preventScroll: true });
    element.scrollIntoView({ block: 'start', behavior: 'instant' });
  }

  function updateProgress() {
    find('[data-fe-count]').textContent = `已答 ${count()} / 48`;
    find<HTMLProgressElement>('[data-fe-progress]').value = count();
  }

  function returnHome() {
    if (count() > 0) save();
    show('intro');
    find<HTMLHeadingElement>('.fe-header h1').tabIndex = -1;
    find<HTMLHeadingElement>('.fe-header h1').focus({ preventScroll: true });
    app.scrollIntoView({ block: 'start', behavior: 'instant' });
  }

  async function submitAnswers() {
    if (submitting) return;
    const missing = answers.findIndex((value, index) => !isValidAnswer(index, value));
    if (missing !== -1) { page = Math.floor(missing / 6); showPage(); return; }
    submitted = true;
    save();
    form.querySelectorAll<HTMLInputElement>('input').forEach(input => { input.disabled = true; });
    if (aiControls.getReport()) { showReport(); return; }
    submitting = true;
    const requestRevision = ++submissionRevision;
    show('submission');
    submission.setAttribute('aria-busy', 'true');
    find('[data-fe-spinner]').hidden = false;
    find('[data-fe-retry]').hidden = true;
    find('[data-fe-submission-home]').hidden = true;
    find('[data-fe-submission-title]').textContent = '正在生成报告';
    find('[data-fe-submission-status]').textContent = '正在逐题分析你的回答，请稍候。';
    moveFocus(find('[data-fe-submission-title]'));
    try {
      await aiControls.generate();
      if (requestRevision === submissionRevision) showReport();
    } catch (error) {
      if (requestRevision !== submissionRevision) return;
      find('[data-fe-submission-title]').textContent = '报告暂未生成';
      find('[data-fe-submission-status]').textContent = error instanceof Error ? error.message : '生成失败，请重试。本次作答已保留。';
      find('[data-fe-retry]').hidden = false;
      find('[data-fe-submission-home]').hidden = false;
    } finally {
      if (requestRevision === submissionRevision) {
        submitting = false;
        submission.setAttribute('aria-busy', 'false');
        find('[data-fe-spinner]').hidden = true;
      }
    }
  }

  function showPage(focus = true) {
    if (submitted) { void submitAnswers(); return; }
    show('quiz');
    pageNodes.forEach((node, index) => { node.hidden = index !== page; });
    find('[data-fe-step]').textContent = `第 ${page + 1} / 8 页`;
    find<HTMLButtonElement>('[data-fe-previous]').disabled = page === 0;
    find('[data-fe-next]').textContent = page === 7 ? '提交' : '下一页 →';
    error.hidden = true;
    updateProgress();
    if (focus) {
      const heading = pageNodes[page].querySelector<HTMLElement>('[data-fe-page-title]')!;
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
  find('[data-fe-start]').addEventListener('click', () => {
    if (submitted) void submitAnswers();
    else { showPage(); save(); }
  });
  find('[data-fe-retry]').addEventListener('click', () => void submitAnswers());
  find('[data-fe-submission-home]').addEventListener('click', returnHome);
  find('[data-fe-home]').addEventListener('click', (event) => { event.preventDefault(); returnHome(); });
  form.addEventListener('change', (event) => {
    if (submitted) return;
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.type !== 'radio' || !/^q\d+$/.test(input.name)) return;
    const index = Number(input.name.slice(1)) - 1;
    const value = index < 36 ? Number(input.value) : input.value;
    if (!isValidAnswer(index, value)) return;
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
    const missing = Array.from({ length: 6 }, (_, offset) => page * 6 + offset).filter((index) => !isValidAnswer(index, answers[index]));
    if (missing.length) {
      error.textContent = `本页还有 ${missing.length} 题未作答，请先完成第 ${missing.map((index) => index + 1).join('、')} 题。`;
      error.hidden = false;
      missing.forEach((index) => find(`[data-fe-question="${index + 1}"]`).setAttribute('data-unanswered', ''));
      moveFocus(find<HTMLInputElement>(`[name="q${missing[0] + 1}"]`));
      return;
    }
    if (page < 7) { page++; save(); showPage(); return; }
    void submitAnswers();
  });
  find('[data-fe-previous]').addEventListener('click', () => { if (!submitted && page > 0) { page--; save(); showPage(); } });
  find('[data-fe-pause]').addEventListener('click', returnHome);
  find('[data-fe-print]').addEventListener('click', async () => {
    const button = find<HTMLButtonElement>('[data-fe-print]');
    const exportStatus = find('[data-fe-export-status]');
    button.disabled = true;
    button.textContent = '正在生成…';
    exportStatus.hidden = true;
    try {
      const snapshot = [...answers];
      const snapshotAi = aiControls.getReport();
      const { createReportPdf } = await import('../lib/four-elements-pdf');
      const blob = await createReportPdf(snapshot, { ai: snapshotAi });
      const reportDate = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai' }).format(new Date());
      downloadReport(blob, `星象测试报告-${reportDate}.pdf`);
    } catch (error) {
      exportStatus.textContent = error instanceof Error ? error.message : '报告生成失败，请重试。';
      exportStatus.hidden = false;
    } finally {
      button.disabled = false;
      button.textContent = '保存报告';
    }
  });
  app.querySelectorAll('[data-fe-clear]').forEach((button) => button.addEventListener('click', () => dialog.showModal()));
  find('[data-fe-cancel-clear]').addEventListener('click', () => dialog.close());
  find('[data-fe-confirm-clear]').addEventListener('click', () => {
    const cleared = draftStore.clear();
    const aiCleared = aiControls.invalidate();
    if (cleared && aiCleared) {
      status.textContent = '';
    } else {
      // Do not claim persistent data was erased when browser storage cannot be accessed.
      status.textContent = '页面中的答案已清空，但无法确认本地存储已删除。请通过浏览器的网站数据设置清除此站点记录。';
    }
    status.hidden = status.textContent === '';
    answers = Array(48).fill(null);
    page = 0;
    completed = false;
    submitted = false;
    submitting = false;
    submissionRevision++;
    form.querySelectorAll<HTMLInputElement>('input').forEach(input => { input.disabled = false; });
    saved = false;
    form.reset();
    app.querySelectorAll('[data-unanswered]').forEach((node) => node.removeAttribute('data-unanswered'));
    find('[data-fe-result]').replaceChildren();
    find('[data-fe-source-slot]').replaceChildren();
    find('[data-fe-export-status]').hidden = true;
    dialog.close();
    returnHome();
  });

  function showReport() {
    const result = scoreAnswers(answers);
    const heading = renderNarrativeReport(find('[data-fe-result]'), result, aiControls.getReport(), find('[data-fe-source-slot]'));
    show('result');
    heading.focus({ preventScroll: true });
    app.scrollIntoView({ block: 'start', behavior: 'instant' });
  }
}
