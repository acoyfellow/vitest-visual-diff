# Security

## Report a vulnerability

Please do not open a public issue for a vulnerability. Email
[jcoeyman@cloudflare.com](mailto:jcoeyman@cloudflare.com) with:

- the affected version or commit;
- a minimal reproduction;
- the impact you observed;
- any suggested mitigation.

You should receive an acknowledgement within three business days.

## Boundary

`vitest-visual-diff` runs inside Vitest Browser Mode and reads DOM structure,
computed styles, accessibility attributes, and element screenshots from the
test page. It does not open network connections, acquire browser sessions, or
write screenshot baselines. Browser-provider credentials remain the provider's
responsibility.
