import { beforeEach, describe, expect, test } from 'vitest';
import { captureVisualDiffFrames, cascadeSequence, type RenderStruct } from '../src/index.ts';

function frame(childCount: number): RenderStruct {
  return {
    tree: {
      tag: 'div',
      role: null,
      attrs: {},
      childCount,
      children: [],
    },
    elements: [],
    elementCount: childCount + 1,
    tagHistogram: { div: 1, span: childCount },
    roles: {},
    hasSvg: false,
    control: {
      tag: 'div',
      role: 'group',
      descendantCount: childCount,
      tags: { span: childCount },
    },
  };
}

function copyFrame(value: RenderStruct): RenderStruct {
  return {
    ...value,
    tree: { ...value.tree },
    tagHistogram: { ...value.tagHistogram },
    control: { ...value.control, tags: { ...value.control.tags } },
  };
}

describe('cascadeSequence', () => {
  test('an identical frame sequence passes every frame', () => {
    const sequence = [frame(1), frame(2), frame(3), frame(4)];
    const result = cascadeSequence(sequence, sequence.map(copyFrame));
    expect(result.pass).toBe(true);
    expect(result.firstDivergence).toBe(-1);
    expect(result.frames.every((item) => item.pass)).toBe(true);
  });

  test('pinpoints the exact first divergent frame', () => {
    const baseline = [frame(1), frame(2), frame(3), frame(4)];
    const broken = [frame(1), frame(1), frame(3), frame(4)];
    const result = cascadeSequence(baseline, broken);
    expect(result.pass).toBe(false);
    expect(result.firstDivergence).toBe(1);
    expect(result.frames[0].pass).toBe(true);
    expect(result.frames[1].pass).toBe(false);
  });

  test('fails closed when the candidate drops a frame', () => {
    const result = cascadeSequence([frame(1), frame(2), frame(3)], [frame(1), frame(2)]);
    expect(result.pass).toBe(false);
    expect(result.firstDivergence).toBe(2);
    expect(result.frames[2]).toMatchObject({ reason: 'frame-count-mismatch' });
  });

  test('fails closed when the candidate adds a frame', () => {
    const result = cascadeSequence([frame(1), frame(2)], [frame(1), frame(2), frame(3)]);
    expect(result.pass).toBe(false);
    expect(result.firstDivergence).toBe(2);
  });

  test('passes two empty sequences', () => {
    const result = cascadeSequence([], []);
    expect(result.pass).toBe(true);
    expect(result.frames).toEqual([]);
  });
});

function animationSource(id: string): HTMLElement {
  const source = document.createElement('div');
  source.id = id;
  source.style.cssText = 'position:fixed;top:0;left:0;height:24px;background:rgb(37, 99, 235);';
  source.innerHTML = '<svg width="12" height="12"><circle cx="6" cy="6" r="5" /></svg>';
  document.body.append(source);
  return source;
}

async function captureAnimation(source: HTMLElement, brokenFrame = -1): Promise<Element[]> {
  return captureVisualDiffFrames(source, {
    frameCount: 4,
    step(frameIndex, element) {
      const htmlElement = element as HTMLElement;
      htmlElement.style.width = `${24 + frameIndex * 8}px`;
      const shouldHaveSvg = frameIndex !== brokenFrame;
      const svg = htmlElement.querySelector('svg');
      if (shouldHaveSvg && !svg) {
        htmlElement.innerHTML = '<svg width="12" height="12"><circle cx="6" cy="6" r="5" /></svg>';
      } else if (!shouldHaveSvg) {
        svg?.remove();
      }
    },
  });
}

describe('toMatchVisualDiffSequence in a real browser', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  test('matches identical requestAnimationFrame-stepped animations', async () => {
    const baseline = await captureAnimation(animationSource('baseline'));
    const candidate = await captureAnimation(animationSource('candidate'));
    await expect(candidate).toMatchVisualDiffSequence(baseline, { pixels: false });
  });

  test('reports the exact broken animation frame and tier', async () => {
    const baseline = await captureAnimation(animationSource('baseline'));
    const candidate = await captureAnimation(animationSource('candidate'), 2);

    let failure = '';
    try {
      await expect(candidate).toMatchVisualDiffSequence(baseline, { pixels: false });
    } catch (error) {
      if (!(error instanceof Error)) throw error;
      failure = error.message;
    }
    expect(failure).toMatch(/frame 2, tier A failed/);
    expect(failure).toMatch(/structure: missing/);
  });
});
