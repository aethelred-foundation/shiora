// ============================================================
// Tests for src/components/PagePrimitives.tsx
// ============================================================

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import {
  MedicalCard,
  CopyButton,
  SectionHeader,
  StatusBadge,
  EncryptionBadge,
  TEEBadge,
  HealthMetricCard,
  TruncatedHash,
  Sparkline,
  ChartTooltip,
} from '@/components/ui/PagePrimitives';

// ---------------------------------------------------------------------------
// MedicalCard
// ---------------------------------------------------------------------------
describe('MedicalCard', () => {
  it('renders children', () => {
    render(
      <MedicalCard>
        <p>Card Content</p>
      </MedicalCard>,
    );
    expect(screen.getByText('Card Content')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <MedicalCard className="my-custom">
        <p>Test</p>
      </MedicalCard>,
    );
    expect(container.firstChild).toHaveClass('my-custom');
  });

  it('applies hover styles by default', () => {
    const { container } = render(
      <MedicalCard>
        <p>Hover</p>
      </MedicalCard>,
    );
    expect(container.firstChild).toHaveClass('hover:shadow-card-hover');
  });

  it('does not apply hover styles when hover=false', () => {
    const { container } = render(
      <MedicalCard hover={false}>
        <p>No Hover</p>
      </MedicalCard>,
    );
    expect(container.firstChild).not.toHaveClass('hover:shadow-card-hover');
  });

  it('applies padding by default', () => {
    const { container } = render(
      <MedicalCard>
        <p>Padded</p>
      </MedicalCard>,
    );
    expect(container.firstChild).toHaveClass('p-5');
  });

  it('does not apply padding when padding=false', () => {
    const { container } = render(
      <MedicalCard padding={false}>
        <p>No Pad</p>
      </MedicalCard>,
    );
    expect(container.firstChild).not.toHaveClass('p-5');
  });

  it('handles onClick', () => {
    const onClick = jest.fn();
    render(
      <MedicalCard onClick={onClick}>
        <p>Clickable</p>
      </MedicalCard>,
    );
    fireEvent.click(screen.getByText('Clickable'));
    expect(onClick).toHaveBeenCalled();
  });

  it('applies cursor-pointer when onClick is provided', () => {
    const { container } = render(
      <MedicalCard onClick={jest.fn()}>
        <p>Click</p>
      </MedicalCard>,
    );
    expect(container.firstChild).toHaveClass('cursor-pointer');
  });
});

// ---------------------------------------------------------------------------
// CopyButton
// ---------------------------------------------------------------------------
describe('CopyButton', () => {
  it('calls clipboard writeText with provided text', () => {
    render(<CopyButton text="copy-me" />);
    const button = screen.getByTitle('Copy to clipboard');
    fireEvent.click(button);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('copy-me');
  });

  it('shows "Copied" state after click', async () => {
    render(<CopyButton text="test" />);
    const button = screen.getByLabelText('Copy to clipboard');
    fireEvent.click(button);
    expect(screen.getByLabelText('Copied')).toBeInTheDocument();
  });

  it('calls onCopied callback when provided', () => {
    const onCopied = jest.fn();
    render(<CopyButton text="data" onCopied={onCopied} />);
    fireEvent.click(screen.getByTitle('Copy to clipboard'));
    expect(onCopied).toHaveBeenCalled();
  });

  it('stops event propagation by default', () => {
    const parentClick = jest.fn();
    render(
      <div onClick={parentClick}>
        <CopyButton text="test" />
      </div>,
    );
    fireEvent.click(screen.getByTitle('Copy to clipboard'));
    expect(parentClick).not.toHaveBeenCalled();
  });

  it('does not stop propagation when stopPropagation=false', () => {
    const parentClick = jest.fn();
    render(
      <div onClick={parentClick}>
        <CopyButton text="test" stopPropagation={false} />
      </div>,
    );
    fireEvent.click(screen.getByTitle('Copy to clipboard'));
    expect(parentClick).toHaveBeenCalled();
  });

  it('renders with md size', () => {
    const { container } = render(<CopyButton text="test" size="md" />);
    expect(container.firstChild).toBeTruthy();
  });

  it('resets copied state after timeout', () => {
    jest.useFakeTimers();
    render(<CopyButton text="test" />);
    fireEvent.click(screen.getByTitle('Copy to clipboard'));
    expect(screen.getByLabelText('Copied')).toBeInTheDocument();
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(screen.getByLabelText('Copy to clipboard')).toBeInTheDocument();
    jest.useRealTimers();
  });
});

// ---------------------------------------------------------------------------
// SectionHeader
// ---------------------------------------------------------------------------
describe('SectionHeader', () => {
  it('renders title', () => {
    render(<SectionHeader title="My Section" />);
    expect(screen.getByText('My Section')).toBeInTheDocument();
  });

  it('renders subtitle when provided', () => {
    render(<SectionHeader title="Title" subtitle="Subtitle text" />);
    expect(screen.getByText('Subtitle text')).toBeInTheDocument();
  });

  it('does not render subtitle when not provided', () => {
    const { container } = render(<SectionHeader title="Title" />);
    const paragraphs = container.querySelectorAll('p');
    expect(paragraphs.length).toBe(0);
  });

  it('renders action when provided', () => {
    render(<SectionHeader title="Title" action={<button>Action</button>} />);
    expect(screen.getByText('Action')).toBeInTheDocument();
  });

  it('renders with large size by default', () => {
    const { container } = render(<SectionHeader title="Big" />);
    expect(container.querySelector('h2')).toHaveClass('text-2xl');
  });

  it('renders with small size', () => {
    const { container } = render(<SectionHeader title="Small" size="sm" />);
    expect(container.querySelector('h2')).toHaveClass('text-xl');
  });

  it('renders with icon prop', () => {
    const MockIcon = (props: React.SVGProps<SVGSVGElement>) => (
      <svg data-testid="section-icon" {...props} />
    );
    const { container } = render(<SectionHeader title="With Icon" icon={MockIcon as any} />);
    expect(container.querySelector('[data-testid="section-icon"]')).toBeInTheDocument();
  });

  it('renders icon with sm size', () => {
    const MockIcon = (props: React.SVGProps<SVGSVGElement>) => (
      <svg data-testid="section-icon-sm" {...props} />
    );
    const { container } = render(
      <SectionHeader title="Small Icon" size="sm" icon={MockIcon as any} />,
    );
    expect(container.querySelector('[data-testid="section-icon-sm"]')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// StatusBadge
// ---------------------------------------------------------------------------
describe('StatusBadge', () => {
  it('renders the status text', () => {
    render(<StatusBadge status="Verified" />);
    expect(screen.getByText('Verified')).toBeInTheDocument();
  });

  it('renders with correct colors for Active status', () => {
    const { container } = render(<StatusBadge status="Active" />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain('bg-emerald-50');
    expect(badge.className).toContain('text-emerald-700');
  });

  it('renders with correct colors for Revoked status', () => {
    const { container } = render(<StatusBadge status="Revoked" />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain('bg-red-50');
  });

  it('renders fallback styles for unknown status', () => {
    const { container } = render(<StatusBadge status="Unknown" />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain('bg-slate-100');
  });

  it('renders a dot indicator', () => {
    const { container } = render(<StatusBadge status="Active" />);
    const dot = container.querySelector('.rounded-full');
    expect(dot).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// EncryptionBadge
// ---------------------------------------------------------------------------
describe('EncryptionBadge', () => {
  it('shows default AES-256 encryption type', () => {
    render(<EncryptionBadge />);
    expect(screen.getByText('AES-256')).toBeInTheDocument();
  });

  it('shows custom encryption type', () => {
    render(<EncryptionBadge type="AES-256-GCM" />);
    expect(screen.getByText('AES-256-GCM')).toBeInTheDocument();
  });

  it('renders a Lock icon', () => {
    const { container } = render(<EncryptionBadge />);
    // lucide-react renders SVG elements
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<EncryptionBadge className="my-enc" />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain('my-enc');
  });
});

// ---------------------------------------------------------------------------
// TEEBadge
// ---------------------------------------------------------------------------
describe('TEEBadge', () => {
  it('shows verified state by default', () => {
    render(<TEEBadge />);
    expect(screen.getByText(/Intel SGX.*Verified/)).toBeInTheDocument();
  });

  it('shows pending state when verified=false', () => {
    render(<TEEBadge verified={false} />);
    expect(screen.getByText(/Intel SGX.*Pending/)).toBeInTheDocument();
  });

  it('shows custom platform', () => {
    render(<TEEBadge platform="AWS Nitro" verified />);
    expect(screen.getByText(/AWS Nitro.*Verified/)).toBeInTheDocument();
  });

  it('uses emerald styles for verified', () => {
    const { container } = render(<TEEBadge verified />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain('bg-emerald-50');
  });

  it('uses amber styles for pending', () => {
    const { container } = render(<TEEBadge verified={false} />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain('bg-amber-50');
  });
});

// ---------------------------------------------------------------------------
// HealthMetricCard
// ---------------------------------------------------------------------------
describe('HealthMetricCard', () => {
  it('renders label, value, and unit', () => {
    render(
      <HealthMetricCard
        icon={<span data-testid="icon">IC</span>}
        label="Records"
        value="147"
        unit="encrypted"
      />,
    );
    expect(screen.getByText('Records')).toBeInTheDocument();
    expect(screen.getByText('147')).toBeInTheDocument();
    expect(screen.getByText('encrypted')).toBeInTheDocument();
  });

  it('renders icon', () => {
    render(
      <HealthMetricCard icon={<span data-testid="test-icon">I</span>} label="Test" value="10" />,
    );
    expect(screen.getByTestId('test-icon')).toBeInTheDocument();
  });

  it('renders trend information', () => {
    render(
      <HealthMetricCard
        icon={<span>I</span>}
        label="Growth"
        value="100"
        trend={4.2}
        trendLabel="this month"
      />,
    );
    expect(screen.getByText('+4.2%')).toBeInTheDocument();
    expect(screen.getByText('this month')).toBeInTheDocument();
  });

  it('renders negative trend', () => {
    render(<HealthMetricCard icon={<span>I</span>} label="Decline" value="50" trend={-2.3} />);
    expect(screen.getByText('-2.3%')).toBeInTheDocument();
  });

  it('renders zero trend', () => {
    render(
      <HealthMetricCard
        icon={<span>I</span>}
        label="Stable"
        value="100"
        trend={0}
        trendLabel="no change"
      />,
    );
    expect(screen.getByText('no change')).toBeInTheDocument();
  });

  it('renders sparkline data when provided', () => {
    const { container } = render(
      <HealthMetricCard
        icon={<span>I</span>}
        label="Sparky"
        value="42"
        sparklineData={[10, 20, 30, 40, 50]}
      />,
    );
    // Sparkline renders an SVG
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBeGreaterThan(0);
  });

  it('renders trendLabel without trend value', () => {
    render(
      <HealthMetricCard
        icon={<span>I</span>}
        label="Metric"
        value="100"
        trendLabel="vs last month"
      />,
    );
    expect(screen.getByText('vs last month')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// TruncatedHash
// ---------------------------------------------------------------------------
describe('TruncatedHash', () => {
  it('truncates long hashes correctly', () => {
    const hash = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
    render(<TruncatedHash hash={hash} />);
    expect(screen.getByText(/0xabcdef12.*567890/)).toBeInTheDocument();
  });

  it('does not truncate short hashes', () => {
    const shortHash = '0xabc123';
    render(<TruncatedHash hash={shortHash} />);
    expect(screen.getByText('0xabc123')).toBeInTheDocument();
  });

  it('includes a copy button', () => {
    render(<TruncatedHash hash="0xabc123def456" />);
    expect(screen.getByTitle('Copy to clipboard')).toBeInTheDocument();
  });

  it('respects custom startLen and endLen', () => {
    const hash = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
    render(<TruncatedHash hash={hash} startLen={6} endLen={4} />);
    expect(screen.getByText('0xabcd...7890')).toBeInTheDocument();
  });

  it('returns null for empty hash', () => {
    const { container } = render(<TruncatedHash hash="" />);
    expect(container.innerHTML).toBe('');
  });
});

// ---------------------------------------------------------------------------
// Sparkline
// ---------------------------------------------------------------------------
describe('Sparkline', () => {
  it('renders an SVG element', () => {
    const { container } = render(<Sparkline data={[10, 20, 30, 40, 50]} />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('renders with custom dimensions', () => {
    const { container } = render(<Sparkline data={[5, 10, 15]} width={100} height={50} />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('width', '100');
    expect(svg).toHaveAttribute('height', '50');
  });

  it('renders a polyline for the data', () => {
    const { container } = render(<Sparkline data={[1, 2, 3, 4, 5]} />);
    const polyline = container.querySelector('polyline');
    expect(polyline).toBeInTheDocument();
  });

  it('handles single data point', () => {
    const { container } = render(<Sparkline data={[42]} />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('is marked as aria-hidden', () => {
    const { container } = render(<Sparkline data={[1, 2, 3]} />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });
});

// ---------------------------------------------------------------------------
// ChartTooltip
// ---------------------------------------------------------------------------
describe('ChartTooltip', () => {
  it('returns null when not active', () => {
    const { container } = render(<ChartTooltip active={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null when payload is empty', () => {
    const { container } = render(<ChartTooltip active={true} payload={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders tooltip data when active with payload', () => {
    render(
      <ChartTooltip
        active={true}
        label="Day 1"
        payload={[{ color: '#8B1538', name: 'Temperature', value: 97.5 }]}
      />,
    );
    expect(screen.getByText('Day 1')).toBeInTheDocument();
    expect(screen.getByText('Temperature:')).toBeInTheDocument();
  });

  it('uses custom formatValue', () => {
    render(
      <ChartTooltip
        active={true}
        payload={[{ color: '#8B1538', name: 'Temp', value: 97.5 }]}
        formatValue={(v) => `${v}F`}
      />,
    );
    expect(screen.getByText('97.5F')).toBeInTheDocument();
  });

  it('renders multiple payload entries', () => {
    render(
      <ChartTooltip
        active={true}
        payload={[
          { color: '#8B1538', name: 'A', value: 10 },
          { color: '#a78bfa', name: 'B', value: 20 },
        ]}
      />,
    );
    expect(screen.getByText('A:')).toBeInTheDocument();
    expect(screen.getByText('B:')).toBeInTheDocument();
  });

  it('formats string values without formatValue callback', () => {
    render(
      <ChartTooltip active={true} payload={[{ color: '#8B1538', name: 'Status', value: 'OK' }]} />,
    );
    expect(screen.getByText('OK')).toBeInTheDocument();
  });
});
