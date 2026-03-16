// ============================================================
// Tests for src/components/ui/EmptyState.tsx
// ============================================================

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { EmptyState } from '@/components/ui/EmptyState';

describe('EmptyState', () => {
  it('renders title', () => {
    render(<EmptyState title="No records found" />);
    expect(screen.getByText('No records found')).toBeInTheDocument();
  });

  it('renders description when provided', () => {
    render(<EmptyState title="Empty" description="Try uploading a file" />);
    expect(screen.getByText('Try uploading a file')).toBeInTheDocument();
  });

  it('does not render description when not provided', () => {
    const { container } = render(<EmptyState title="Empty" />);
    const paragraphs = container.querySelectorAll('p');
    expect(paragraphs.length).toBe(0);
  });

  it('renders default icon when none provided', () => {
    const { container } = render(<EmptyState title="Empty" />);
    // lucide Inbox icon renders as SVG
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('renders custom icon', () => {
    render(
      <EmptyState
        title="Empty"
        icon={<span data-testid="custom-icon">IC</span>}
      />
    );
    expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
  });

  it('renders primary action button and calls onClick', () => {
    const onClick = jest.fn();
    render(
      <EmptyState
        title="Empty"
        action={{ label: 'Upload', onClick }}
      />
    );
    const button = screen.getByText('Upload');
    expect(button).toBeInTheDocument();
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalled();
  });

  it('renders secondary action button and calls onClick', () => {
    const onClick = jest.fn();
    render(
      <EmptyState
        title="Empty"
        secondaryAction={{ label: 'Learn More', onClick }}
      />
    );
    const button = screen.getByText('Learn More');
    expect(button).toBeInTheDocument();
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalled();
  });

  it('renders both primary and secondary actions', () => {
    render(
      <EmptyState
        title="Empty"
        action={{ label: 'Upload', onClick: jest.fn() }}
        secondaryAction={{ label: 'Cancel', onClick: jest.fn() }}
      />
    );
    expect(screen.getByText('Upload')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('renders with small size', () => {
    const { container } = render(<EmptyState title="Small" size="sm" />);
    expect(container.firstChild).toHaveClass('py-8');
  });

  it('renders with medium size by default', () => {
    const { container } = render(<EmptyState title="Medium" />);
    expect(container.firstChild).toHaveClass('py-16');
  });

  it('renders with large size', () => {
    const { container } = render(<EmptyState title="Large" size="lg" />);
    expect(container.firstChild).toHaveClass('py-24');
  });

  it('applies custom className', () => {
    const { container } = render(<EmptyState title="Custom" className="my-custom" />);
    expect(container.firstChild).toHaveClass('my-custom');
  });
});
