// Browser-native frame capture. Each requested animation frame is cloned into
// an isolated snapshot host and has its computed CSS frozen inline, so later
// matcher evaluation observes the render as it existed at capture time.

export interface CaptureVisualDiffFramesOptions {
  frameCount: number;
  step?: (frame: number, element: Element) => void | Promise<void>;
  snapshotContainer?: Element;
}

function animationFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function copyComputedStyles(source: Element, snapshot: Element): void {
  if (source instanceof HTMLElement || source instanceof SVGElement) {
    const computed = getComputedStyle(source);
    const snapshotStyle = (snapshot as HTMLElement | SVGElement).style;
    for (const property of computed) {
      snapshotStyle.setProperty(
        property,
        computed.getPropertyValue(property),
        computed.getPropertyPriority(property),
      );
    }
  }

  const sourceChildren = Array.from(source.children);
  const snapshotChildren = Array.from(snapshot.children);
  for (let index = 0; index < sourceChildren.length; index++) {
    const snapshotChild = snapshotChildren[index];
    if (snapshotChild) copyComputedStyles(sourceChildren[index], snapshotChild);
  }
}

function createSnapshotHost(): HTMLElement {
  const host = document.createElement('div');
  host.dataset.visualDiffSnapshots = '';
  host.style.cssText =
    'position:absolute;left:0;top:0;width:max-content;z-index:-2147483647;pointer-events:none;';
  document.body.append(host);
  return host;
}

/**
 * Capture stable DOM snapshots while advancing a live element one browser
 * animation frame at a time. The returned Elements can be passed directly to
 * `toMatchVisualDiffSequence`; convert them to Vitest Locators when pixel
 * comparison is required.
 */
export async function captureVisualDiffFrames(
  element: Element,
  options: CaptureVisualDiffFramesOptions,
): Promise<Element[]> {
  if (!Number.isInteger(options.frameCount) || options.frameCount < 0) {
    throw new RangeError('vitest-visual-diff: frameCount must be a non-negative integer');
  }

  const container = options.snapshotContainer ?? createSnapshotHost();
  const frames: Element[] = [];
  for (let frame = 0; frame < options.frameCount; frame++) {
    await animationFrame();
    await options.step?.(frame, element);
    await animationFrame();

    const snapshot = element.cloneNode(true) as Element;
    copyComputedStyles(element, snapshot);
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'display:block;width:max-content;contain:layout style paint;';
    wrapper.append(snapshot);
    container.append(wrapper);
    frames.push(snapshot);
  }
  return frames;
}
