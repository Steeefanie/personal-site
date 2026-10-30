import { isHeifFile, visibleContentSize } from '../lib/fuse-bead/image';

type Locale = 'zh-CN' | 'zh-TW' | 'en';

const form = document.querySelector<HTMLFormElement>('[data-generator-form]');
const fileInput = document.querySelector<HTMLInputElement>('[data-file-input]');
const uploadZone = document.querySelector<HTMLElement>('[data-upload-zone]');
const fileSummary = document.querySelector<HTMLElement>('[data-file-summary]');
const fileName = document.querySelector<HTMLElement>('[data-file-name]');
const fileMeta = document.querySelector<HTMLElement>('[data-file-meta]');
const removeButton = document.querySelector<HTMLButtonElement>('[data-file-remove]');
const sizeInput = document.querySelector<HTMLInputElement>('[data-size-input]');
const sizeEstimate = document.querySelector<HTMLElement>('[data-size-estimate]');
const generateButton = document.querySelector<HTMLButtonElement>('[data-generate-button]');
const buttonLabel = document.querySelector<HTMLElement>('[data-button-label]');
const formMessage = document.querySelector<HTMLElement>('[data-form-message]');
const previewEmpty = document.querySelector<HTMLElement>('[data-preview-empty]');
const previewImage = document.querySelector<HTMLImageElement>('[data-preview-image]');
const previewLoading = document.querySelector<HTMLElement>('[data-preview-loading]');
const previewTitle = document.querySelector<HTMLElement>('[data-preview-title]');
const previewMode = document.querySelector<HTMLElement>('[data-preview-mode]');
const resultMeta = document.querySelector<HTMLElement>('[data-result-meta]');
const resultSize = document.querySelector<HTMLElement>('[data-result-size]');
const resultMode = document.querySelector<HTMLElement>('[data-result-mode]');
const resultCount = document.querySelector<HTMLElement>('[data-result-count]');
const downloadButton = document.querySelector<HTMLAnchorElement>('[data-download-button]');
const uploadMessage = document.querySelector<HTMLElement>('[data-upload-message]');

let selectedFile: File | null = null;
let sourceWidth = 0;
let sourceHeight = 0;
let sourceUrl = '';
let resultUrl = '';
let selectionVersion = 0;
let generationVersion = 0;
let previewController: AbortController | null = null;
let generationController: AbortController | null = null;

const copy = {
  invalidType: { 'zh-CN': '请上传 JPEG、PNG、WebP 或 HEIF 图片。', 'zh-TW': '請上傳 JPEG、PNG、WebP 或 HEIF 圖片。', en: 'Please upload a JPEG, PNG, WebP, or HEIF image.' },
  tooLarge: { 'zh-CN': '图片不能超过 20 MB。', 'zh-TW': '圖片不能超過 20 MB。', en: 'The image must be no larger than 20 MB.' },
  invalidImage: { 'zh-CN': '无法读取这张图片，请更换文件。', 'zh-TW': '無法讀取這張圖片，請更換檔案。', en: 'This image could not be read. Please choose another file.' },
  tooManyCells: { 'zh-CN': '按当前比例计算后超出图纸尺寸限制，请减小格数。', 'zh-TW': '依目前比例計算後超出圖紙尺寸限制，請減少格數。', en: 'The calculated pattern exceeds the size limit. Please use fewer cells.' },
  previewing: { 'zh-CN': '正在处理图片预览，请稍候……', 'zh-TW': '正在處理圖片預覽，請稍候……', en: 'Preparing the image preview…' },
  previewBusy: { 'zh-CN': '当前使用人数较多，暂时无法处理 HEIF 图片，请稍后重新选择。', 'zh-TW': '目前使用人數較多，暫時無法處理 HEIF 圖片，請稍後重新選擇。', en: 'The service is busy and cannot process this HEIF image right now. Please choose it again later.' },
  generationBusy: { 'zh-CN': '当前生成任务较多，请稍后再次点击生成图纸。', 'zh-TW': '目前產生任務較多，請稍後再次點擊產生圖紙。', en: 'There are too many generation requests right now. Please try generating again shortly.' },
  serviceUnavailable: { 'zh-CN': '服务暂时不可用，请稍后重试。', 'zh-TW': '服務暫時無法使用，請稍後再試。', en: 'The service is temporarily unavailable. Please try again later.' },
  generationTimeout: { 'zh-CN': '生成超时，请减小图纸尺寸后重试。', 'zh-TW': '產生逾時，請縮小圖紙尺寸後再試。', en: 'Generation timed out. Please reduce the pattern size and try again.' },
  failed: { 'zh-CN': '生成失败，请稍后重试。', 'zh-TW': '產生失敗，請稍後重試。', en: 'Generation failed. Please try again later.' },
  generating: { 'zh-CN': '排队或生成中……', 'zh-TW': '排隊或產生中……', en: 'Queueing or generating…' },
  generate: { 'zh-CN': '生成图纸', 'zh-TW': '產生圖紙', en: 'Generate pattern' },
  sourcePreview: { 'zh-CN': '原图预览', 'zh-TW': '原圖預覽', en: 'Source preview' },
  resultPreview: { 'zh-CN': '图纸预览', 'zh-TW': '圖紙預覽', en: 'Pattern preview' },
  estimate: { 'zh-CN': '预计图纸', 'zh-TW': '預計圖紙', en: 'Estimated pattern' },
} as const;

const locale = (): Locale => {
  const value = document.documentElement.dataset.language;
  return value === 'zh-TW' || value === 'en' ? value : 'zh-CN';
};
const t = (key: keyof typeof copy) => copy[key][locale()];
const isAbortError = (error: unknown) => error instanceof Error && error.name === 'AbortError';
const showMessage = (message: string) => {
  if (formMessage) {
    formMessage.textContent = message;
    formMessage.hidden = false;
  }
};
const clearMessage = () => {
  if (formMessage) formMessage.hidden = true;
};
const showUploadMessage = (message: string, tone: 'info' | 'error' = 'error') => {
  if (uploadMessage) {
    uploadMessage.textContent = message;
    uploadMessage.dataset.tone = tone;
    uploadMessage.hidden = false;
  }
};
const clearUploadMessage = () => {
  if (uploadMessage) {
    uploadMessage.hidden = true;
    delete uploadMessage.dataset.tone;
  }
};
const selectedSide = () => form?.querySelector<HTMLInputElement>('input[name="fixed_side"]:checked')?.value ?? 'height';
const selectedMode = () => form?.querySelector<HTMLInputElement>('input[name="mode"]:checked')?.value.toUpperCase() ?? 'CMS';
const maxGridCells = 20_000;
const maxGridEdge = 400;

const timestamp12 = (date: Date) => [
  String(date.getFullYear()).slice(-2),
  String(date.getMonth() + 1).padStart(2, '0'),
  String(date.getDate()).padStart(2, '0'),
  String(date.getHours()).padStart(2, '0'),
  String(date.getMinutes()).padStart(2, '0'),
  String(date.getSeconds()).padStart(2, '0'),
].join('');

const calculatedSize = () => {
  const fixed = Number(sizeInput?.value ?? 50);
  if (!sourceWidth || !sourceHeight || !Number.isFinite(fixed)) return null;
  const width = selectedSide() === 'width' ? fixed : Math.max(1, Math.round(sourceWidth * fixed / sourceHeight));
  const height = selectedSide() === 'height' ? fixed : Math.max(1, Math.round(sourceHeight * fixed / sourceWidth));
  return {
    width,
    height,
    count: width * height,
    valid: Number.isInteger(fixed)
      && fixed >= 1
      && width <= maxGridEdge
      && height <= maxGridEdge
      && width * height <= maxGridCells,
  };
};

const formatEstimate = (width: number, height: number, count: number) => {
  if (locale() === 'en') return `Estimated pattern: ${width} × ${height} cells · ${count.toLocaleString('en-US')} total`;
  if (locale() === 'zh-TW') return `預計圖紙：${width} × ${height} 格 · 共 ${count.toLocaleString('zh-TW')} 格`;
  return `预计图纸：${width} × ${height} 格 · 共 ${count.toLocaleString('zh-CN')} 格`;
};

const updateEstimate = () => {
  const estimate = calculatedSize();
  if (previewMode) previewMode.textContent = selectedMode();
  if (!estimate || !sizeEstimate) return;
  sizeEstimate.hidden = false;
  sizeEstimate.textContent = formatEstimate(estimate.width, estimate.height, estimate.count);
  sizeEstimate.dataset.valid = String(estimate.valid);
  if (generateButton) {
    generateButton.disabled = generateButton.dataset.loading === 'true' || !selectedFile || !estimate.valid;
  }
  if (!estimate.valid) showMessage(t('tooManyCells'));
  else clearMessage();
};

const resetResult = () => {
  if (resultUrl) URL.revokeObjectURL(resultUrl);
  resultUrl = '';
  if (resultMeta) resultMeta.hidden = true;
  if (downloadButton) downloadButton.hidden = true;
};

const restoreGenerationUi = () => {
  if (previewLoading) previewLoading.hidden = true;
  if (generateButton) delete generateButton.dataset.loading;
  if (buttonLabel) buttonLabel.textContent = t('generate');
  updateEstimate();
};

const cancelPreview = () => {
  previewController?.abort();
  previewController = null;
  if (uploadZone) {
    delete uploadZone.dataset.loading;
    uploadZone.removeAttribute('aria-busy');
  }
  if (fileInput) fileInput.disabled = false;
};

const cancelGeneration = () => {
  generationVersion += 1;
  generationController?.abort();
  generationController = null;
  restoreGenerationUi();
};

const clearFileSelection = (clearInput: boolean) => {
  selectedFile = null;
  sourceWidth = 0;
  sourceHeight = 0;
  if (sourceUrl) URL.revokeObjectURL(sourceUrl);
  sourceUrl = '';
  resetResult();
  if (clearInput && fileInput) fileInput.value = '';
  if (fileSummary) fileSummary.hidden = true;
  if (previewImage) {
    previewImage.hidden = true;
    previewImage.removeAttribute('src');
  }
  if (previewEmpty) previewEmpty.hidden = false;
  if (previewTitle) previewTitle.textContent = t('sourcePreview');
  if (sizeEstimate) sizeEstimate.hidden = true;
  if (generateButton) generateButton.disabled = true;
};

const resetFile = () => {
  selectionVersion += 1;
  cancelPreview();
  cancelGeneration();
  clearFileSelection(true);
  clearMessage();
  clearUploadMessage();
};

const setFile = async (file: File) => {
  const requestVersion = ++selectionVersion;
  cancelPreview();
  cancelGeneration();
  clearMessage();
  clearUploadMessage();
  clearFileSelection(false);

  const heifFile = isHeifFile(file);
  const acceptedType = ['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || heifFile;
  if (!acceptedType) {
    if (fileInput) fileInput.value = '';
    showUploadMessage(t('invalidType'));
    return;
  }
  if (file.size > 20 * 1024 * 1024) {
    if (fileInput) fileInput.value = '';
    showUploadMessage(t('tooLarge'));
    return;
  }

  let decodedSize: { width: number; height: number } | null = null;
  let visibleSize: { width: number; height: number } | null = null;
  let candidateUrl = '';
  const controller = heifFile ? new AbortController() : null;
  previewController = controller;

  try {
    if (heifFile) {
      if (uploadZone) {
        uploadZone.dataset.loading = 'true';
        uploadZone.setAttribute('aria-busy', 'true');
      }
      if (fileInput) fileInput.disabled = true;
      showUploadMessage(t('previewing'), 'info');
      const payload = new FormData();
      payload.set('image', file);
      let response: Response;
      try {
        response = await fetch('/api/v1/fuse-bead/preview', {
          method: 'POST',
          body: payload,
          signal: controller?.signal,
        });
      } catch (error) {
        if (isAbortError(error)) throw error;
        throw new Error(t('serviceUnavailable'));
      }
      if (!response.ok) {
        let detail = '';
        try { detail = (await response.json()).detail ?? ''; } catch { /* The proxy may return HTML. */ }
        if (response.status === 429) throw new Error(t('previewBusy'));
        if (response.status === 413) throw new Error(t('tooLarge'));
        if ([404, 502, 503].includes(response.status)) throw new Error(t('serviceUnavailable'));
        throw new Error(detail || t('invalidImage'));
      }
      const sourceHeaderWidth = Number(response.headers.get('X-Source-Width'));
      const sourceHeaderHeight = Number(response.headers.get('X-Source-Height'));
      const visibleHeaderWidth = Number(response.headers.get('X-Visible-Width'));
      const visibleHeaderHeight = Number(response.headers.get('X-Visible-Height'));
      if (sourceHeaderWidth > 0 && sourceHeaderHeight > 0) decodedSize = { width: sourceHeaderWidth, height: sourceHeaderHeight };
      if (visibleHeaderWidth > 0 && visibleHeaderHeight > 0) visibleSize = { width: visibleHeaderWidth, height: visibleHeaderHeight };
      const converted = await response.blob();
      candidateUrl = URL.createObjectURL(converted);
    } else {
      candidateUrl = URL.createObjectURL(file);
    }
  } catch (error) {
    if (candidateUrl) URL.revokeObjectURL(candidateUrl);
    if (requestVersion !== selectionVersion || isAbortError(error)) return;
    console.error('Image preview preparation failed', error instanceof Error ? error.message : error);
    if (fileInput) fileInput.value = '';
    showUploadMessage(error instanceof Error ? error.message : t('invalidImage'));
    return;
  } finally {
    if (requestVersion === selectionVersion) {
      if (uploadZone) {
        delete uploadZone.dataset.loading;
        uploadZone.removeAttribute('aria-busy');
      }
      if (fileInput) fileInput.disabled = false;
      if (previewController === controller) previewController = null;
    }
  }

  const probe = new Image();
  probe.onload = () => {
    if (requestVersion !== selectionVersion) {
      URL.revokeObjectURL(candidateUrl);
      return;
    }
    sourceUrl = candidateUrl;
    selectedFile = file;
    const originalWidth = decodedSize?.width ?? probe.naturalWidth;
    const originalHeight = decodedSize?.height ?? probe.naturalHeight;
    if (!visibleSize && ['image/png', 'image/webp'].includes(file.type)) {
      visibleSize = visibleContentSize(probe, probe.naturalWidth, probe.naturalHeight);
    }
    sourceWidth = visibleSize?.width ?? originalWidth;
    sourceHeight = visibleSize?.height ?? originalHeight;
    if (fileName) fileName.textContent = file.name;
    if (fileMeta) fileMeta.textContent = `${originalWidth} × ${originalHeight} · ${(file.size / 1024 / 1024).toFixed(2)} MB`;
    if (fileSummary) fileSummary.hidden = false;
    if (previewImage) {
      previewImage.src = sourceUrl;
      previewImage.alt = file.name;
      previewImage.hidden = false;
    }
    if (previewEmpty) previewEmpty.hidden = true;
    if (previewTitle) previewTitle.textContent = t('sourcePreview');
    clearUploadMessage();
    updateEstimate();
  };
  probe.onerror = () => {
    URL.revokeObjectURL(candidateUrl);
    if (requestVersion !== selectionVersion) return;
    if (fileInput) fileInput.value = '';
    showUploadMessage(t('invalidImage'));
  };
  probe.src = candidateUrl;
};

const handleConfigurationChange = () => {
  if (generationController) cancelGeneration();
  resetResult();
  if (previewImage && sourceUrl) previewImage.src = sourceUrl;
  if (previewTitle && selectedFile) previewTitle.textContent = t('sourcePreview');
  updateEstimate();
};

fileInput?.addEventListener('change', () => {
  const file = fileInput.files?.[0];
  if (file) void setFile(file);
});
removeButton?.addEventListener('click', resetFile);
form?.querySelectorAll<HTMLInputElement>('input[name="fixed_side"], input[name="mode"]')
  .forEach((input) => input.addEventListener('change', handleConfigurationChange));
sizeInput?.addEventListener('input', handleConfigurationChange);

['dragenter', 'dragover'].forEach((name) => uploadZone?.addEventListener(name, (event) => {
  event.preventDefault();
  uploadZone.dataset.dragging = 'true';
}));
['dragleave', 'drop'].forEach((name) => uploadZone?.addEventListener(name, (event) => {
  event.preventDefault();
  delete uploadZone.dataset.dragging;
}));
uploadZone?.addEventListener('drop', (event) => {
  if (uploadZone.dataset.loading === 'true') return;
  const file = event.dataTransfer?.files?.[0];
  if (file) void setFile(file);
});

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const estimate = calculatedSize();
  if (!selectedFile || !estimate?.valid || !generateButton) return;

  generationController?.abort();
  const controller = new AbortController();
  const requestVersion = ++generationVersion;
  const requestedFile = selectedFile;
  const requestedMode = selectedMode();
  const requestedSide = selectedSide();
  const requestedSize = String(sizeInput?.value ?? 50);
  generationController = controller;
  const isCurrentRequest = () => requestVersion === generationVersion
    && generationController === controller
    && selectedFile === requestedFile;

  clearMessage();
  resetResult();
  generateButton.disabled = true;
  generateButton.dataset.loading = 'true';
  if (buttonLabel) buttonLabel.textContent = t('generating');
  if (previewLoading) previewLoading.hidden = false;

  const payload = new FormData();
  payload.set('image', requestedFile);
  payload.set('fixed_side', requestedSide);
  payload.set('size', requestedSize);
  payload.set('mode', requestedMode.toLowerCase());

  try {
    let response: Response;
    try {
      response = await fetch('/api/v1/fuse-bead/generate', {
        method: 'POST',
        body: payload,
        signal: controller.signal,
      });
    } catch (error) {
      if (isAbortError(error)) throw error;
      throw new Error(t('serviceUnavailable'));
    }
    if (!response.ok) {
      let detail = '';
      try { detail = (await response.json()).detail ?? ''; } catch { /* The proxy may return HTML. */ }
      if (response.status === 429) throw new Error(t('generationBusy'));
      if (response.status === 413) throw new Error(t('tooLarge'));
      if (response.status === 504) throw new Error(t('generationTimeout'));
      if ([404, 502, 503].includes(response.status)) throw new Error(t('serviceUnavailable'));
      throw new Error(detail || t('failed'));
    }

    const blob = await response.blob();
    if (!isCurrentRequest()) return;
    resultUrl = URL.createObjectURL(blob);
    if (previewImage) {
      previewImage.src = resultUrl;
      previewImage.alt = t('resultPreview');
      previewImage.hidden = false;
    }
    if (previewEmpty) previewEmpty.hidden = true;
    if (previewTitle) previewTitle.textContent = t('resultPreview');
    if (resultMeta) resultMeta.hidden = false;
    if (resultSize) resultSize.textContent = `${response.headers.get('X-Pattern-Width') ?? estimate.width} × ${response.headers.get('X-Pattern-Height') ?? estimate.height}`;
    if (resultMode) resultMode.textContent = requestedMode;
    if (resultCount) resultCount.textContent = response.headers.get('X-Colour-Count') ?? '—';
    if (downloadButton) {
      downloadButton.href = resultUrl;
      downloadButton.download = `${requestedFile.name.replace(/\.[^.]+$/, '')}_${timestamp12(new Date())}.png`;
      downloadButton.hidden = false;
    }
  } catch (error) {
    if (!isCurrentRequest() || isAbortError(error)) return;
    showMessage(error instanceof Error ? error.message : t('failed'));
    if (previewImage && sourceUrl) previewImage.src = sourceUrl;
    if (previewTitle) previewTitle.textContent = t('sourcePreview');
  } finally {
    if (isCurrentRequest()) {
      generationController = null;
      restoreGenerationUi();
    }
  }
});

addEventListener('beforeunload', () => {
  cancelPreview();
  generationController?.abort();
  if (sourceUrl) URL.revokeObjectURL(sourceUrl);
  if (resultUrl) URL.revokeObjectURL(resultUrl);
});
