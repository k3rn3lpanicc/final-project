export function setupModalCloseHandlers(modal: HTMLElement) {
  const closeBtn = modal.querySelector('.modal-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => modal.remove());
  }

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });

  const escHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      modal.remove();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.removedNodes.forEach((node) => {
        if (node === modal) {
          document.removeEventListener('keydown', escHandler);
          observer.disconnect();
        }
      });
    });
  });
  observer.observe(document.body, { childList: true });
}
