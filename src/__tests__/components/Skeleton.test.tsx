// ============================================================
// Tests for src/components/ui/Skeleton.tsx
// ============================================================

import React from 'react';
import { render } from '@testing-library/react';
import {
  SkeletonLine,
  SkeletonText,
  SkeletonAvatar,
  SkeletonBadge,
  SkeletonCard,
  SkeletonMetric,
  SkeletonTable,
  SkeletonChart,
  SkeletonStats,
} from '@/components/ui/Skeleton';

// ---------------------------------------------------------------------------
// SkeletonLine
// ---------------------------------------------------------------------------
describe('SkeletonLine', () => {
  it('renders with default width and height', () => {
    const { container } = render(<SkeletonLine />);
    const el = container.firstChild as HTMLElement;
    expect(el).toHaveClass('skeleton');
    expect(el.style.width).toBe('100%');
    expect(el.style.height).toBe('1rem');
  });

  it('renders with custom width and height', () => {
    const { container } = render(<SkeletonLine width="50%" height="2rem" />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.width).toBe('50%');
    expect(el.style.height).toBe('2rem');
  });

  it('applies custom className', () => {
    const { container } = render(<SkeletonLine className="my-class" />);
    expect(container.firstChild).toHaveClass('my-class');
  });

  it('is aria-hidden', () => {
    const { container } = render(<SkeletonLine />);
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
  });
});

// ---------------------------------------------------------------------------
// SkeletonText
// ---------------------------------------------------------------------------
describe('SkeletonText', () => {
  it('renders 3 lines by default', () => {
    const { container } = render(<SkeletonText />);
    const lines = container.querySelectorAll('.skeleton');
    expect(lines.length).toBe(3);
  });

  it('renders custom number of lines', () => {
    const { container } = render(<SkeletonText lines={5} />);
    const lines = container.querySelectorAll('.skeleton');
    expect(lines.length).toBe(5);
  });

  it('last line has 60% width', () => {
    const { container } = render(<SkeletonText lines={3} />);
    const lines = container.querySelectorAll('.skeleton');
    expect((lines[2] as HTMLElement).style.width).toBe('60%');
  });

  it('is aria-hidden', () => {
    const { container } = render(<SkeletonText />);
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
  });

  it('applies custom className', () => {
    const { container } = render(<SkeletonText className="custom" />);
    expect(container.firstChild).toHaveClass('custom');
  });
});

// ---------------------------------------------------------------------------
// SkeletonAvatar
// ---------------------------------------------------------------------------
describe('SkeletonAvatar', () => {
  it('renders with default size of 40px', () => {
    const { container } = render(<SkeletonAvatar />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.width).toBe('40px');
    expect(el.style.height).toBe('40px');
  });

  it('renders with custom size', () => {
    const { container } = render(<SkeletonAvatar size={64} />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.width).toBe('64px');
    expect(el.style.height).toBe('64px');
  });

  it('has rounded-full class', () => {
    const { container } = render(<SkeletonAvatar />);
    expect(container.firstChild).toHaveClass('rounded-full');
  });

  it('is aria-hidden', () => {
    const { container } = render(<SkeletonAvatar />);
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
  });
});

// ---------------------------------------------------------------------------
// SkeletonBadge
// ---------------------------------------------------------------------------
describe('SkeletonBadge', () => {
  it('renders with default width of 64px', () => {
    const { container } = render(<SkeletonBadge />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.width).toBe('64px');
  });

  it('renders with custom width', () => {
    const { container } = render(<SkeletonBadge width={100} />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.width).toBe('100px');
  });

  it('is aria-hidden', () => {
    const { container } = render(<SkeletonBadge />);
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
  });
});

// ---------------------------------------------------------------------------
// SkeletonCard
// ---------------------------------------------------------------------------
describe('SkeletonCard', () => {
  it('renders with default height of 12rem', () => {
    const { container } = render(<SkeletonCard />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.height).toBe('12rem');
  });

  it('renders with custom height', () => {
    const { container } = render(<SkeletonCard height="20rem" />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.height).toBe('20rem');
  });

  it('is aria-hidden', () => {
    const { container } = render(<SkeletonCard />);
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
  });
});

// ---------------------------------------------------------------------------
// SkeletonMetric
// ---------------------------------------------------------------------------
describe('SkeletonMetric', () => {
  it('renders without crashing', () => {
    const { container } = render(<SkeletonMetric />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('is aria-hidden', () => {
    const { container } = render(<SkeletonMetric />);
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
  });

  it('contains skeleton elements', () => {
    const { container } = render(<SkeletonMetric />);
    const skeletons = container.querySelectorAll('.skeleton');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('applies custom className', () => {
    const { container } = render(<SkeletonMetric className="custom" />);
    expect(container.firstChild).toHaveClass('custom');
  });
});

// ---------------------------------------------------------------------------
// SkeletonTable
// ---------------------------------------------------------------------------
describe('SkeletonTable', () => {
  it('renders default 5 rows and 4 columns', () => {
    const { container } = render(<SkeletonTable />);
    // Header row + 5 data rows = 6 flex rows
    const rows = container.querySelectorAll('.flex.gap-4');
    expect(rows.length).toBe(6);
  });

  it('renders custom rows and columns', () => {
    const { container } = render(<SkeletonTable rows={3} columns={2} />);
    const rows = container.querySelectorAll('.flex.gap-4');
    expect(rows.length).toBe(4); // 1 header + 3 data rows
  });

  it('is aria-hidden', () => {
    const { container } = render(<SkeletonTable />);
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
  });
});

// ---------------------------------------------------------------------------
// SkeletonChart
// ---------------------------------------------------------------------------
describe('SkeletonChart', () => {
  it('renders with default height of 200px', () => {
    const { container } = render(<SkeletonChart />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.height).toBe('200px');
  });

  it('renders with custom height', () => {
    const { container } = render(<SkeletonChart height={400} />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.height).toBe('400px');
  });

  it('is aria-hidden', () => {
    const { container } = render(<SkeletonChart />);
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
  });
});

// ---------------------------------------------------------------------------
// SkeletonStats
// ---------------------------------------------------------------------------
describe('SkeletonStats', () => {
  it('renders 4 stat placeholders by default', () => {
    const { container } = render(<SkeletonStats />);
    const items = container.querySelectorAll('.skeleton');
    expect(items.length).toBe(4);
  });

  it('renders custom count', () => {
    const { container } = render(<SkeletonStats count={2} />);
    const items = container.querySelectorAll('.skeleton');
    expect(items.length).toBe(2);
  });

  it('is aria-hidden', () => {
    const { container } = render(<SkeletonStats />);
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
  });

  it('applies custom className', () => {
    const { container } = render(<SkeletonStats className="my-grid" />);
    expect(container.firstChild).toHaveClass('my-grid');
  });
});
