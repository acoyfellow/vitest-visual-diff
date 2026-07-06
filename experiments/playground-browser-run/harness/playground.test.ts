import { expect, test } from 'vitest';
import { page } from 'vitest/browser';
import 'vitest-visual-diff';

test('identical checkboxes pass', async () => {
  const checkbox = (id: string) => `
    <button data-testid="${id}" role="checkbox" aria-checked="true"
      style="width:20px;height:20px;background:#2563eb;border-radius:4px;">
      <svg width="12" height="12"><path d="M2 6l3 3 5-7" stroke="white" stroke-width="2" fill="none"/></svg>
    </button>`;
  document.body.innerHTML = `
    <div style="position:fixed;top:0;left:0;">${checkbox('a')}</div>
    <div style="position:fixed;top:100px;left:0;">${checkbox('b')}</div>
  `;
  await expect(page.getByTestId('b')).toMatchVisualDiff(page.getByTestId('a'));
});

test('missing checkmark fails', async () => {
  document.body.innerHTML = `
    <div style="position:fixed;top:0;left:0;">
      <button data-testid="c" role="checkbox" aria-checked="true" style="width:20px;height:20px;background:#2563eb;border-radius:4px;">
        <svg width="12" height="12"><path d="M2 6l3 3 5-7" stroke="white" stroke-width="2" fill="none"/></svg>
      </button>
    </div>
    <div style="position:fixed;top:100px;left:0;">
      <button data-testid="d" role="checkbox" aria-checked="true" style="width:20px;height:20px;background:#2563eb;border-radius:4px;"></button>
    </div>
  `;
  await expect(page.getByTestId('d')).not.toMatchVisualDiff(page.getByTestId('c'));
});
