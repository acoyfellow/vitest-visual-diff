// This is the README tutorial copied into the real project test suite.
// Keeping it executable prevents the getting-started path from drifting.
import { expect, test } from 'vitest';
import { page } from 'vitest/browser';

test('two identically-styled checkboxes match', async () => {
  const checkbox = (testId: string) => `
    <button data-testid="${testId}" role="checkbox" aria-checked="true"
      style="width:20px; height:20px; background:#2563eb; border-radius:4px;">
      <svg width="12" height="12"><path d="M2 6l3 3 5-7" stroke="white" stroke-width="2" fill="none"/></svg>
    </button>`;

  document.body.innerHTML = `
    <div style="position:fixed; top:0; left:0;">${checkbox('checkbox-old')}</div>
    <div style="position:fixed; top:100px; left:0;">${checkbox('checkbox-new')}</div>
  `;

  const oldCheckbox = page.getByTestId('checkbox-old');
  const newCheckbox = page.getByTestId('checkbox-new');

  await expect(newCheckbox).toMatchVisualDiff(oldCheckbox);
});
