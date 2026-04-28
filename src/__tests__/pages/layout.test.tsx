// ============================================================
// Tests for src/app/layout.tsx
// ============================================================

import React from 'react';
import { render, screen } from '@testing-library/react';

// Mock Providers since it wraps QueryClientProvider
jest.mock('@/components/layout/Providers', () => ({
  Providers: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="providers">{children}</div>
  ),
}));

import RootLayout, { metadata, viewport } from '@/app/layout';

describe('RootLayout', () => {
  it('renders children inside Providers', () => {
    const { container } = render(
      <RootLayout>
        <div data-testid="child">Hello</div>
      </RootLayout>,
    );
    expect(screen.getByTestId('providers')).toBeInTheDocument();
    expect(screen.getByTestId('child')).toBeInTheDocument();
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('renders skip to main content link', () => {
    render(
      <RootLayout>
        <div>Content</div>
      </RootLayout>,
    );
    expect(screen.getByText('Skip to main content')).toBeInTheDocument();
  });

  it('renders html element with lang attribute', () => {
    const { container } = render(
      <RootLayout>
        <div>Content</div>
      </RootLayout>,
    );
    const htmlEl = container.querySelector('html');
    expect(htmlEl).toBeTruthy();
    expect(htmlEl?.getAttribute('lang')).toBe('en');
  });

  it('exports metadata with title and description', () => {
    expect(metadata).toBeDefined();
    expect(metadata.title).toBeDefined();
    expect(metadata.description).toContain("Women's Health AI Platform");
    expect(metadata.openGraph).toBeDefined();
    expect(metadata.twitter).toBeDefined();
  });

  it('exports viewport with theme color', () => {
    expect(viewport).toBeDefined();
    expect(viewport.themeColor).toBe('#8B1538');
  });

  it('renders body with correct classes', () => {
    const { container } = render(
      <RootLayout>
        <div>Content</div>
      </RootLayout>,
    );
    const bodyEl = container.querySelector('body');
    expect(bodyEl).toBeTruthy();
    expect(bodyEl?.className).toContain('bg-surface-50');
  });
});
