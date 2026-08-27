/** @jest-environment node */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Modal } from '@/components/ui/SharedComponents';

describe('Modal SSR', () => {
  it('renders nothing when no document is available for the portal', () => {
    expect(
      renderToStaticMarkup(
        <Modal open={true} onClose={jest.fn()}>
          Content
        </Modal>,
      ),
    ).toBe('');
  });
});
