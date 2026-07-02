/**
 * Accessibility gate (GAP-24): axe-core runs over key user-facing components
 * and fails on any WCAG 2.1 A/AA violation. Colour-contrast is checked in the
 * browser E2E pass, not here (jsdom has no paint engine).
 */

import React from 'react';
import { render } from '@testing-library/react';
import { expectNoA11yViolations } from '../helpers/axe';

import { SealedField } from '@/components/crypto/SealedField';
import { EmptyState } from '@/components/ui/EmptyState';
import NotFound from '@/app/not-found';
import GlobalError from '@/app/global-error';

describe('accessibility — key components (GAP-24)', () => {
  it('SealedField (locked) has no violations', async () => {
    const { container } = render(
      <SealedField
        value=""
        onChange={() => {}}
        isUnlocked={false}
        isUnlocking={false}
        onUnlock={() => {}}
        placeholder="Notes about your symptom"
      />,
    );
    await expectNoA11yViolations(container);
  });

  it('SealedField (unlocked) has no violations', async () => {
    const { container } = render(
      <SealedField
        value="private note"
        onChange={() => {}}
        isUnlocked
        isUnlocking={false}
        onUnlock={() => {}}
      />,
    );
    await expectNoA11yViolations(container);
  });

  it('EmptyState with actions has no violations', async () => {
    const { container } = render(
      <EmptyState
        title="No records yet"
        description="Upload your first record to get started."
        action={{ label: 'Upload', onClick: () => {} }}
        secondaryAction={{ label: 'Learn more', onClick: () => {} }}
      />,
    );
    await expectNoA11yViolations(container);
  });

  it('the 404 page has no violations', async () => {
    const { container } = render(<NotFound />);
    await expectNoA11yViolations(container);
  });

  it('the global error page has no violations', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const { container } = render(
      <GlobalError error={Object.assign(new Error('boom'), { digest: 'd1' })} reset={() => {}} />,
    );
    await expectNoA11yViolations(container);
    jest.restoreAllMocks();
  });
});
