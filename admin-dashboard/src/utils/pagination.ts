export function generatePageNumbers(current: number, total: number): string {
  const pages: (number | string)[] = [];
  const maxVisible = 7;

  if (total <= maxVisible) {
    for (let i = 1; i <= total; i++) {
      pages.push(i);
    }
  } else {
    pages.push(1);

    if (current > 3) {
      pages.push('...');
    }

    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (current < total - 2) {
      pages.push('...');
    }

    if (total > 1) {
      pages.push(total);
    }
  }

  return pages
    .map((page) => {
      if (page === '...') {
        return '<span class="page-ellipsis">...</span>';
      }
      const isActive = page === current ? 'active' : '';
      return `<button class="btn-page-num ${isActive}" onclick="goToPage(${page})">${page}</button>`;
    })
    .join('');
}
