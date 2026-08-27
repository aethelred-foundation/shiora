// ============================================================
// Shiora on Aethelred — Accessibility assertion helper (GAP-24)
//
// Runs axe-core (already a dependency) against a rendered container and fails
// with a readable report if any WCAG violation is found. Colour-contrast is
// disabled because jsdom has no layout/paint engine to compute it — that check
// belongs in a real-browser E2E pass; everything else (roles, names, labels,
// landmarks, ARIA validity) runs here as a fast unit-level gate.
// ============================================================

import axe from 'axe-core';

const JSDOM_SAFE_CONFIG: axe.RunOptions = {
  runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
  rules: {
    'color-contrast': { enabled: false }, // needs a paint engine jsdom lacks
  },
};

/** Assert the container has no axe-detectable accessibility violations. */
export async function expectNoA11yViolations(container: Element): Promise<void> {
  const results = await axe.run(container, JSDOM_SAFE_CONFIG);
  if (results.violations.length > 0) {
    const report = results.violations
      .map((v) => {
        const targets = v.nodes.map((n) => `      ${n.target.join(' ')}`).join('\n');
        return `  • [${v.impact}] ${v.id}: ${v.help}\n${targets}\n    ${v.helpUrl}`;
      })
      .join('\n');
    throw new Error(`Accessibility violations found:\n${report}`);
  }
}
