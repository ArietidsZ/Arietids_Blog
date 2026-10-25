/**
 * Copy buttons on code blocks. integrations/article.mjs renders them hidden, so a page without
 * this script never shows a button that does nothing; here they appear and copy the block's text.
 */
document.querySelectorAll<HTMLButtonElement>('[data-code-copy]').forEach((btn) => {
  btn.hidden = false;
  const label = btn.querySelector<HTMLElement>('[data-label]');
  const resting = label?.textContent ?? '';
  let timer = 0;
  btn.addEventListener('click', async () => {
    const text = btn.closest('figure')?.querySelector('pre')?.innerText.replace(/\n$/, '') ?? '';
    let ok = false;
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch {
      ok = false;
    }
    const message = ok ? (btn.dataset.copied ?? '✓') : (document.body.dataset.copyFailedLabel ?? 'Copy failed');
    if (label) label.textContent = message;
    btn.toggleAttribute('data-done', ok);
    const status = document.querySelector<HTMLElement>('[data-status]');
    if (status) status.textContent = message;
    clearTimeout(timer);
    timer = window.setTimeout(() => {
      if (label) label.textContent = resting;
      btn.removeAttribute('data-done');
      if (status) status.textContent = '';
    }, 1800);
  });
});

export {};
