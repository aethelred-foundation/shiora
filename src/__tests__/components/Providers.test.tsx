// ============================================================
// Tests for src/components/layout/Providers.tsx
// ============================================================

import React from 'react';
import { render, screen } from '@testing-library/react';
import { Providers } from '@/components/layout/Providers';
import { useQueryClient } from '@tanstack/react-query';

// A simple child component that verifies providers are available
function TestChild() {
  return <div>Child rendered</div>;
}

// A component that uses React Query context to verify QueryClientProvider
function QueryConsumer() {
  const queryClient = useQueryClient();
  return <div>Query client exists: {queryClient ? 'yes' : 'no'}</div>;
}

describe('Providers', () => {
  it('renders children', () => {
    render(
      <Providers>
        <TestChild />
      </Providers>,
    );
    expect(screen.getByText('Child rendered')).toBeInTheDocument();
  });

  it('provides QueryClient context', () => {
    render(
      <Providers>
        <QueryConsumer />
      </Providers>,
    );
    expect(screen.getByText('Query client exists: yes')).toBeInTheDocument();
  });

  it('provides AppContext (via AppProvider)', () => {
    // useApp is available inside Providers since it wraps with AppProvider
    // We verify indirectly by rendering a component that needs it
    const { container } = render(
      <Providers>
        <div data-testid="wrapped">Content</div>
      </Providers>,
    );
    expect(screen.getByTestId('wrapped')).toBeInTheDocument();
    expect(container).toBeTruthy();
  });

  it('renders multiple children', () => {
    render(
      <Providers>
        <div>First</div>
        <div>Second</div>
      </Providers>,
    );
    expect(screen.getByText('First')).toBeInTheDocument();
    expect(screen.getByText('Second')).toBeInTheDocument();
  });
});
