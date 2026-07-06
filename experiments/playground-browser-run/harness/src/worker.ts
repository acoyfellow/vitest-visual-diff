// Minimal Worker so the Vite Cloudflare plugin's tunnel has an app to attach
// to — Browser Run's local Vitest dev server needs a public origin, and the
// tunnel plugin requires a Worker context, per Brendan's example shape. This
// experiment isolates whether the tunnel+CDP path works for one arbitrary
// visitor-supplied test file, not whether a real playground app is built.
export default {
  async fetch() {
    return new Response('vitest-visual-diff playground browser-run harness');
  },
};
