/** Development-only, in-memory fixture. Uses the real giscus theme, with no network writes. */
export async function mountCommentsPreview(root: HTMLElement, cleanup: (callback: () => void) => void, ready: () => void) {
  const mount = root.querySelector<HTMLElement>('[data-giscus-mount]');
  if (!mount) return;
  root.dataset.giscusPreview = 'true';
  const frame = document.createElement('iframe');
  let disposed = false;
  cleanup(() => { disposed = true; frame.remove(); });
  frame.className = 'giscus-frame';
  frame.title = '本地留言模拟（不会发布）';
  frame.style.cssText = 'width:100%;border:0;display:block;';
  frame.setAttribute('sandbox', 'allow-same-origin allow-forms');
  const themes = await Promise.all(['/giscus-light.css', '/giscus-dark.css'].map(async (url) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Unable to load the local comment theme');
    return response.text();
  }));
  if (disposed || !root.isConnected) return;
  frame.srcdoc = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
      *{box-sizing:border-box}html,body{margin:0;background:transparent;font:16px/1.65 var(--font-family-default)}
      main{color:var(--color-fg-default);padding:2px 3px 16px}.gsc-main{display:grid;gap:24px}
      button,textarea{font:inherit}button{cursor:pointer;min-height:44px;padding:8px 16px;color:inherit}button:disabled{cursor:default;opacity:.45}
      .preview-note{margin:0 0 20px;color:var(--color-fg-muted);font-size:13px}.gsc-comment-box-tabs{display:flex;padding:6px;gap:4px}
      .gsc-comment-box-textarea{width:100%;resize:vertical;display:block}.gsc-comment-box-preview{min-height:132px;padding:15px 16px;white-space:pre-wrap;overflow-wrap:anywhere}
      .gsc-comment-box-bottom,.gsc-header,.gsc-comment-header{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
      .gsc-comment-box-bottom small,.gsc-comment-header small{color:var(--color-fg-muted)}.gsc-right-header{display:flex;gap:4px;padding:6px}
      .gsc-comment>div{padding:20px}.gsc-comment-header{font-size:14px}.avatar{display:inline-grid;place-items:center;width:32px;height:32px;border-radius:50%;background:var(--color-neutral-muted);margin-right:8px}
      .gsc-comment-content{white-space:pre-wrap;overflow-wrap:anywhere;margin:16px 0}.gsc-comment-footer{display:flex;gap:8px}.gsc-comment{margin-top:16px}
      [hidden]{display:none!important}:focus-visible{outline:2px solid var(--color-fg-muted);outline-offset:2px}
      @media(max-width:440px){.gsc-comment-box-bottom{align-items:stretch}.gsc-comment-box-bottom small{flex-basis:100%}.gsc-comment>div{padding:16px}}
    </style><style id="comment-theme"></style></head><body><main>
    <p class="preview-note">本地模拟 · 示例留言，不会发布或保存到 GitHub；刷新后清除。</p>
    <div class="gsc-main">
      <form class="gsc-comment-box" id="composer">
        <div class="gsc-comment-box-tabs"><button type="button" class="color-text-primary" data-tab="write" aria-pressed="true">撰写</button><button type="button" data-tab="preview" aria-pressed="false">预览</button></div>
        <div class="gsc-comment-box-main"><div class="gsc-comment-box-write"><textarea class="gsc-comment-box-textarea" aria-label="模拟留言内容" placeholder="写下你的留言……" required></textarea></div><div class="gsc-comment-box-preview" hidden></div></div>
        <div class="gsc-comment-box-bottom"><small>仅用于本地界面预览</small><button class="btn btn-primary" type="submit" disabled>模拟发送</button></div>
      </form>
      <div class="gsc-header"><span class="gsc-comments-count" aria-live="polite"></span><ul class="gsc-right-header BtnGroup" role="group" aria-label="留言排序"><li class="BtnGroup-item BtnGroup-item--selected" aria-current="true"><button class="btn" type="button" data-order="old" aria-pressed="true">最早</button></li><li class="BtnGroup-item" aria-current="false"><button class="btn" type="button" data-order="new" aria-pressed="false">最新</button></li></ul></div>
      <div class="gsc-timeline" aria-live="polite"></div>
    </div></main></body></html>`;
  frame.addEventListener('load', () => {
    if (disposed) return;
    const doc = frame.contentDocument;
    if (!doc) return;
    const style = doc.querySelector<HTMLStyleElement>('#comment-theme')!;
    const updateTheme = () => {
      const dark = document.documentElement.dataset.theme === 'dark';
      doc.documentElement.style.colorScheme = dark ? 'dark' : 'light';
      frame.style.colorScheme = dark ? 'dark' : 'light';
      style.textContent = themes[dark ? 1 : 0];
    };
    updateTheme();
    const themeObserver = new MutationObserver(updateTheme);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    cleanup(() => themeObserver.disconnect());
    const form = doc.querySelector<HTMLFormElement>('#composer')!;
    const input = form.querySelector<HTMLTextAreaElement>('textarea')!;
    const submit = form.querySelector<HTMLButtonElement>('[type="submit"]')!;
    const preview = form.querySelector<HTMLElement>('.gsc-comment-box-preview')!;
    const comments = [{ author: '示例访客', text: '这是用于检查玻璃卡片、长文字换行和回复状态的示例留言。', replies: [] as string[] }];
    let newest = false;
    const render = () => {
      const timeline = doc.querySelector('.gsc-timeline')!;
      timeline.replaceChildren();
      doc.querySelector('.gsc-comments-count')!.textContent = `${comments.length} 条模拟留言`;
      (newest ? [...comments].reverse() : comments).forEach((comment) => {
        const article = doc.createElement('article');
        article.className = 'gsc-comment';
        article.innerHTML = `<div><header class="gsc-comment-header"><strong></strong><small>本地示例</small></header><p class="gsc-comment-content"></p><div class="gsc-comment-footer"><button class="btn" type="button" aria-pressed="false" data-like>♡ 0</button><button class="btn" type="button" data-reply>回复</button></div><div data-replies></div><form class="gsc-comment-box" hidden style="margin-top:16px"><textarea class="gsc-comment-box-textarea" aria-label="模拟回复内容" placeholder="写下回复……" required></textarea><div class="gsc-comment-box-bottom"><button class="btn" type="submit">模拟回复</button></div></form></div>`;
        article.querySelector('strong')!.textContent = comment.author;
        article.querySelector('.gsc-comment-content')!.textContent = comment.text;
        comment.replies.forEach((text) => { const p = doc.createElement('p'); p.textContent = `本地访客：${text}`; article.querySelector('[data-replies]')!.append(p); });
        const like = article.querySelector<HTMLButtonElement>('[data-like]')!;
        like.onclick = () => { const selected = like.getAttribute('aria-pressed') !== 'true'; like.setAttribute('aria-pressed', String(selected)); like.textContent = selected ? '♥ 1' : '♡ 0'; };
        const reply = article.querySelector<HTMLFormElement>('form')!;
        article.querySelector<HTMLButtonElement>('[data-reply]')!.onclick = () => { reply.hidden = !reply.hidden; if (!reply.hidden) reply.querySelector('textarea')!.focus(); };
        reply.onsubmit = (event) => { event.preventDefault(); const text = reply.querySelector('textarea')!.value.trim(); if (text) { comment.replies.push(text); render(); } };
        timeline.append(article);
      });
    };
    input.oninput = () => { submit.disabled = !input.value.trim(); };
    form.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((button) => { button.onclick = () => {
      const isPreview = button.dataset.tab === 'preview';
      input.parentElement!.hidden = isPreview;
      preview.hidden = !isPreview;
      preview.textContent = input.value || '暂无内容';
      form.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((tab) => { const selected = tab === button; tab.classList.toggle('color-text-primary', selected); tab.setAttribute('aria-pressed', String(selected)); });
    }; });
    form.onsubmit = (event) => { event.preventDefault(); const text = input.value.trim(); if (!text) return; comments.push({ author: '本地访客', text, replies: [] }); input.value = ''; preview.textContent = '暂无内容'; submit.disabled = true; render(); };
    doc.querySelectorAll<HTMLButtonElement>('[data-order]').forEach((button) => { button.onclick = () => { newest = button.dataset.order === 'new'; doc.querySelectorAll('[data-order]').forEach((item) => { const selected = item === button; item.setAttribute('aria-pressed', String(selected)); item.parentElement!.setAttribute('aria-current', String(selected)); item.parentElement!.classList.toggle('BtnGroup-item--selected', selected); }); render(); }; });
    const size = new ResizeObserver(() => { frame.style.height = `${Math.ceil(doc.querySelector('main')!.getBoundingClientRect().height)}px`; });
    // Observe content, rather than the iframe-sized document, to allow shrinking after replies close.
    size.observe(doc.querySelector('main')!);
    cleanup(() => size.disconnect());
    render();
    ready();
  }, { once: true });
  mount.replaceChildren(frame);
}
