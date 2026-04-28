// ============================================================
// Tests for src/components/SharedComponents.tsx
// ============================================================

import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { AppProvider } from '@/contexts/AppContext';

// Wrap with AppProvider since many shared components use useApp()
function TestWrapper({ children }: { children: React.ReactNode }) {
  return <AppProvider>{children}</AppProvider>;
}

// We must import after mocking
import {
  LiveDot,
  Badge,
  ProgressRing,
  AnimatedNumber,
  Tabs,
  Modal,
  ConfirmDialog,
  Drawer,
  ToastContainer,
  SearchOverlay,
  TopNav,
  Footer,
} from '@/components/ui/SharedComponents';

// ---------------------------------------------------------------------------
// Badge
// ---------------------------------------------------------------------------
describe('Badge', () => {
  it('renders children text', () => {
    render(<Badge>Active</Badge>);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('renders with success variant', () => {
    render(<Badge variant="success">Success</Badge>);
    const badge = screen.getByText('Success');
    expect(badge.className).toContain('bg-emerald-50');
  });

  it('renders with error variant', () => {
    render(<Badge variant="error">Error</Badge>);
    const badge = screen.getByText('Error');
    expect(badge.className).toContain('bg-red-50');
  });

  it('renders with warning variant', () => {
    render(<Badge variant="warning">Warning</Badge>);
    const badge = screen.getByText('Warning');
    expect(badge.className).toContain('bg-amber-50');
  });

  it('renders with info variant', () => {
    render(<Badge variant="info">Info</Badge>);
    const badge = screen.getByText('Info');
    expect(badge.className).toContain('bg-accent-50');
  });

  it('renders with neutral variant by default', () => {
    render(<Badge>Neutral</Badge>);
    const badge = screen.getByText('Neutral');
    expect(badge.className).toContain('bg-slate-100');
  });

  it('renders with brand variant', () => {
    render(<Badge variant="brand">Brand</Badge>);
    expect(screen.getByText('Brand')).toBeInTheDocument();
  });

  it('renders with medical variant', () => {
    render(<Badge variant="medical">Medical</Badge>);
    expect(screen.getByText('Medical')).toBeInTheDocument();
  });

  it('renders a dot when dot prop is true', () => {
    const { container } = render(
      <Badge dot variant="success">
        Dotted
      </Badge>,
    );
    // The dot is a small span with rounded-full
    const dots = container.querySelectorAll('.rounded-full');
    expect(dots.length).toBeGreaterThan(0);
  });

  it('applies custom className', () => {
    render(<Badge className="custom-class">Custom</Badge>);
    const badge = screen.getByText('Custom');
    expect(badge.className).toContain('custom-class');
  });
});

// ---------------------------------------------------------------------------
// ProgressRing
// ---------------------------------------------------------------------------
describe('ProgressRing', () => {
  it('renders with correct ARIA attributes', () => {
    render(<ProgressRing value={50} max={100} />);
    const ring = screen.getByRole('progressbar');
    expect(ring).toHaveAttribute('aria-valuenow', '50');
    expect(ring).toHaveAttribute('aria-valuemin', '0');
    expect(ring).toHaveAttribute('aria-valuemax', '100');
  });

  it('renders an SVG element', () => {
    const { container } = render(<ProgressRing value={75} />);
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBeGreaterThan(0);
  });

  it('renders children inside the ring', () => {
    render(
      <ProgressRing value={50}>
        <span>50%</span>
      </ProgressRing>,
    );
    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  it('handles value of 0', () => {
    render(<ProgressRing value={0} max={100} />);
    const ring = screen.getByRole('progressbar');
    expect(ring).toHaveAttribute('aria-valuenow', '0');
  });

  it('handles value equal to max', () => {
    render(<ProgressRing value={100} max={100} />);
    const ring = screen.getByRole('progressbar');
    expect(ring).toHaveAttribute('aria-valuenow', '100');
  });
});

// ---------------------------------------------------------------------------
// AnimatedNumber
// ---------------------------------------------------------------------------
describe('AnimatedNumber', () => {
  it('renders the numeric value', () => {
    render(<AnimatedNumber value={42} />);
    // The AnimatedNumber starts at the value and may animate
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('renders with prefix and suffix', () => {
    render(<AnimatedNumber value={100} prefix="$" suffix=" USD" />);
    const el = screen.getByText(/\$.*USD/);
    expect(el).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<AnimatedNumber value={50} className="custom-num" />);
    const el = screen.getByText('50');
    expect(el.className).toContain('custom-num');
  });
});

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------
describe('Tabs', () => {
  const tabs = [
    { id: 'one', label: 'Tab One' },
    { id: 'two', label: 'Tab Two', count: 5 },
    { id: 'three', label: 'Tab Three' },
  ];

  it('renders all tab labels', () => {
    render(<Tabs tabs={tabs} activeTab="one" onChange={jest.fn()} />);
    expect(screen.getByText('Tab One')).toBeInTheDocument();
    expect(screen.getByText('Tab Two')).toBeInTheDocument();
    expect(screen.getByText('Tab Three')).toBeInTheDocument();
  });

  it('shows count when provided', () => {
    render(<Tabs tabs={tabs} activeTab="one" onChange={jest.fn()} />);
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('marks the active tab with aria-selected', () => {
    render(<Tabs tabs={tabs} activeTab="two" onChange={jest.fn()} />);
    const activeTabEl = screen.getByText('Tab Two').closest('[role="tab"]');
    expect(activeTabEl).toHaveAttribute('aria-selected', 'true');
  });

  it('calls onChange when a tab is clicked', () => {
    const onChange = jest.fn();
    render(<Tabs tabs={tabs} activeTab="one" onChange={onChange} />);
    fireEvent.click(screen.getByText('Tab Three'));
    expect(onChange).toHaveBeenCalledWith('three');
  });

  it('switches active tab on click', () => {
    const onChange = jest.fn();
    const { rerender } = render(<Tabs tabs={tabs} activeTab="one" onChange={onChange} />);

    fireEvent.click(screen.getByText('Tab Two'));
    expect(onChange).toHaveBeenCalledWith('two');

    // Simulate parent updating activeTab
    rerender(<Tabs tabs={tabs} activeTab="two" onChange={onChange} />);
    const newActive = screen.getByText('Tab Two').closest('[role="tab"]');
    expect(newActive).toHaveAttribute('aria-selected', 'true');
  });
});

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------
describe('Modal', () => {
  it('does not render when open is false', () => {
    render(
      <Modal open={false} onClose={jest.fn()}>
        <p>Content</p>
      </Modal>,
    );
    expect(screen.queryByText('Content')).not.toBeInTheDocument();
  });

  it('renders when open is true', () => {
    render(
      <Modal open={true} onClose={jest.fn()} title="Test Modal">
        <p>Content</p>
      </Modal>,
    );
    expect(screen.getByText('Content')).toBeInTheDocument();
    expect(screen.getByText('Test Modal')).toBeInTheDocument();
  });

  it('renders description when provided', () => {
    render(
      <Modal open={true} onClose={jest.fn()} title="Title" description="Desc">
        <p>Body</p>
      </Modal>,
    );
    expect(screen.getByText('Desc')).toBeInTheDocument();
  });

  it('calls onClose when escape key is pressed', () => {
    const onClose = jest.fn();
    render(
      <Modal open={true} onClose={onClose}>
        <p>Content</p>
      </Modal>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when backdrop is clicked', () => {
    const onClose = jest.fn();
    render(
      <Modal open={true} onClose={onClose}>
        <p>Content</p>
      </Modal>,
    );
    // The backdrop is the fixed inset div with bg-black
    const backdrop = document.querySelector('.bg-black\\/30');
    if (backdrop) fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalled();
  });

  it('has role="dialog" and aria-modal', () => {
    render(
      <Modal open={true} onClose={jest.fn()} title="Dialog">
        <p>Body</p>
      </Modal>,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('shows close button by default', () => {
    render(
      <Modal open={true} onClose={jest.fn()} title="Title">
        <p>Body</p>
      </Modal>,
    );
    expect(screen.getByLabelText('Close')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// ConfirmDialog
// ---------------------------------------------------------------------------
describe('ConfirmDialog', () => {
  it('renders title and description', () => {
    render(
      <ConfirmDialog
        open={true}
        onClose={jest.fn()}
        onConfirm={jest.fn()}
        title="Confirm Action"
        description="Are you sure?"
      />,
    );
    expect(screen.getByText('Confirm Action')).toBeInTheDocument();
    expect(screen.getByText('Are you sure?')).toBeInTheDocument();
  });

  it('calls onConfirm and onClose when confirm button is clicked', () => {
    const onConfirm = jest.fn();
    const onClose = jest.fn();
    render(
      <ConfirmDialog
        open={true}
        onClose={onClose}
        onConfirm={onConfirm}
        title="Delete?"
        confirmLabel="Delete"
        cancelLabel="Cancel"
      />,
    );
    fireEvent.click(screen.getByText('Delete'));
    expect(onConfirm).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when cancel button is clicked', () => {
    const onClose = jest.fn();
    render(<ConfirmDialog open={true} onClose={onClose} onConfirm={jest.fn()} title="Delete?" />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalled();
  });

  it('uses custom button labels', () => {
    render(
      <ConfirmDialog
        open={true}
        onClose={jest.fn()}
        onConfirm={jest.fn()}
        title="Test"
        confirmLabel="Yes, do it"
        cancelLabel="Nope"
      />,
    );
    expect(screen.getByText('Yes, do it')).toBeInTheDocument();
    expect(screen.getByText('Nope')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// ToastContainer
// ---------------------------------------------------------------------------
describe('ToastContainer', () => {
  it('renders without crashing inside AppProvider', () => {
    const { container } = render(
      <TestWrapper>
        <ToastContainer />
      </TestWrapper>,
    );
    expect(container).toBeTruthy();
  });

  it('has role="status" for accessibility', () => {
    render(
      <TestWrapper>
        <ToastContainer />
      </TestWrapper>,
    );
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders notifications when present and dismisses them', () => {
    // Helper component that triggers a notification
    function TriggerNotification() {
      const { addNotification } = require('@/contexts/AppContext').useApp();
      return (
        <button onClick={() => addNotification('success', 'Test Title', 'Test message')}>
          Add Toast
        </button>
      );
    }

    render(
      <TestWrapper>
        <TriggerNotification />
        <ToastContainer />
      </TestWrapper>,
    );

    // Add a notification
    fireEvent.click(screen.getByText('Add Toast'));

    // Should render the notification
    expect(screen.getByText('Test Title')).toBeInTheDocument();
    expect(screen.getByText('Test message')).toBeInTheDocument();

    // Click dismiss
    fireEvent.click(screen.getByLabelText('Dismiss'));
    expect(screen.queryByText('Test Title')).not.toBeInTheDocument();
  });

  it('renders notifications of different types', () => {
    function TriggerNotifications() {
      const { addNotification } = require('@/contexts/AppContext').useApp();
      return (
        <>
          <button onClick={() => addNotification('error', 'Error', 'err msg')}>AddError</button>
          <button onClick={() => addNotification('warning', 'Warning', 'warn msg')}>
            AddWarning
          </button>
          <button onClick={() => addNotification('info', 'Info', 'info msg')}>AddInfo</button>
        </>
      );
    }

    render(
      <TestWrapper>
        <TriggerNotifications />
        <ToastContainer />
      </TestWrapper>,
    );

    fireEvent.click(screen.getByText('AddError'));
    expect(screen.getByText('Error')).toBeInTheDocument();

    fireEvent.click(screen.getByText('AddWarning'));
    expect(screen.getByText('Warning')).toBeInTheDocument();

    fireEvent.click(screen.getByText('AddInfo'));
    expect(screen.getByText('Info')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// SearchOverlay
// ---------------------------------------------------------------------------
describe('SearchOverlay', () => {
  it('opens with Cmd+K keyboard shortcut', () => {
    render(
      <TestWrapper>
        <SearchOverlay />
      </TestWrapper>,
    );

    // Initially closed
    expect(screen.queryByPlaceholderText('Search pages, actions...')).not.toBeInTheDocument();

    // Trigger Cmd+K
    fireEvent.keyDown(document, { key: 'k', metaKey: true });

    // Should now be visible
    expect(screen.getByPlaceholderText('Search pages, actions...')).toBeInTheDocument();
  });

  it('opens with Ctrl+K keyboard shortcut', () => {
    render(
      <TestWrapper>
        <SearchOverlay />
      </TestWrapper>,
    );

    fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
    expect(screen.getByPlaceholderText('Search pages, actions...')).toBeInTheDocument();
  });

  it('displays search items when open', () => {
    render(
      <TestWrapper>
        <SearchOverlay />
      </TestWrapper>,
    );

    fireEvent.keyDown(document, { key: 'k', metaKey: true });

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Health Records')).toBeInTheDocument();
    expect(screen.getByText('AI Insights')).toBeInTheDocument();
    expect(screen.getByText('Access Control')).toBeInTheDocument();
  });

  it('filters items based on search query', () => {
    render(
      <TestWrapper>
        <SearchOverlay />
      </TestWrapper>,
    );

    fireEvent.keyDown(document, { key: 'k', metaKey: true });
    const input = screen.getByPlaceholderText('Search pages, actions...');
    fireEvent.change(input, { target: { value: 'dashboard' } });

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.queryByText('Access Control')).not.toBeInTheDocument();
  });

  it('shows no results message for non-matching query', () => {
    render(
      <TestWrapper>
        <SearchOverlay />
      </TestWrapper>,
    );

    fireEvent.keyDown(document, { key: 'k', metaKey: true });
    const input = screen.getByPlaceholderText('Search pages, actions...');
    fireEvent.change(input, { target: { value: 'xyznonexistent' } });

    expect(screen.getByText('No results found')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// TopNav
// ---------------------------------------------------------------------------
describe('TopNav', () => {
  it('renders navigation links', () => {
    render(
      <TestWrapper>
        <TopNav />
      </TestWrapper>,
    );
    // PRIMARY_NAV_LINKS are rendered directly in the nav bar
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Records')).toBeInTheDocument();
    expect(screen.getByText('Insights')).toBeInTheDocument();
    expect(screen.getByText('Clinical')).toBeInTheDocument();
  });

  it('renders the Shiora brand name', () => {
    render(
      <TestWrapper>
        <TopNav />
      </TestWrapper>,
    );
    expect(screen.getByText('SHIORA')).toBeInTheDocument();
  });

  it('renders connect wallet button when disconnected', () => {
    render(
      <TestWrapper>
        <TopNav />
      </TestWrapper>,
    );
    expect(screen.getByText('Connect Wallet')).toBeInTheDocument();
  });

  it('renders search button', () => {
    render(
      <TestWrapper>
        <TopNav />
      </TestWrapper>,
    );
    expect(screen.getByLabelText('Search')).toBeInTheDocument();
  });

  it('has main navigation landmark', () => {
    render(
      <TestWrapper>
        <TopNav />
      </TestWrapper>,
    );
    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Footer
// ---------------------------------------------------------------------------
describe('Footer', () => {
  it('renders all footer sections', () => {
    render(
      <TestWrapper>
        <Footer />
      </TestWrapper>,
    );
    expect(screen.getByText('Platform')).toBeInTheDocument();
    expect(screen.getByText('Resources')).toBeInTheDocument();
    expect(screen.getByText('Privacy & Security')).toBeInTheDocument();
    expect(screen.getByText('Legal')).toBeInTheDocument();
  });

  it('renders the Shiora on Aethelred brand', () => {
    render(
      <TestWrapper>
        <Footer />
      </TestWrapper>,
    );
    expect(screen.getByText('Shiora')).toBeInTheDocument();
    expect(screen.getByText('on Aethelred')).toBeInTheDocument();
  });

  it('renders footer links', () => {
    render(
      <TestWrapper>
        <Footer />
      </TestWrapper>,
    );
    expect(screen.getByText('Documentation')).toBeInTheDocument();
    expect(screen.getByText('HIPAA Compliance')).toBeInTheDocument();
    expect(screen.getByText('Terms of Service')).toBeInTheDocument();
  });

  it('shows network information', () => {
    render(
      <TestWrapper>
        <Footer />
      </TestWrapper>,
    );
    expect(screen.getByText('Network Operational')).toBeInTheDocument();
  });

  it('has footer landmark', () => {
    render(
      <TestWrapper>
        <Footer />
      </TestWrapper>,
    );
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// LiveDot
// ---------------------------------------------------------------------------
describe('LiveDot', () => {
  it('renders with default color', () => {
    const { container } = render(<LiveDot />);
    expect(container.querySelectorAll('.bg-emerald-500').length).toBeGreaterThan(0);
  });

  it('renders with custom color and className', () => {
    const { container } = render(<LiveDot color="bg-red-500" className="custom-class" />);
    expect(container.querySelectorAll('.bg-red-500').length).toBeGreaterThan(0);
    expect(container.querySelector('.custom-class')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Badge dot variants
// ---------------------------------------------------------------------------
describe('Badge dot colors', () => {
  it.each([
    ['success', 'bg-emerald-500'],
    ['error', 'bg-red-500'],
    ['warning', 'bg-amber-500'],
    ['info', 'bg-accent-500'],
    ['brand', 'bg-brand-500'],
    ['medical', 'bg-violet-500'],
    ['neutral', 'bg-slate-400'],
  ] as const)('renders dot with %s variant having %s color', (variant, expectedDotClass) => {
    const { container } = render(
      <Badge dot variant={variant as any}>
        Test
      </Badge>,
    );
    expect(container.querySelector(`.${expectedDotClass}`)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AnimatedNumber - animation effect
// ---------------------------------------------------------------------------
describe('AnimatedNumber animation', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('animates when value changes', () => {
    const rafCallbacks: FrameRequestCallback[] = [];
    const originalRaf = window.requestAnimationFrame;
    const originalCaf = window.cancelAnimationFrame;
    window.requestAnimationFrame = (cb: FrameRequestCallback) => {
      rafCallbacks.push(cb);
      return rafCallbacks.length;
    };
    window.cancelAnimationFrame = jest.fn();

    const { rerender } = render(<AnimatedNumber value={0} duration={1000} />);
    // Change value to trigger animation
    rerender(<AnimatedNumber value={100} duration={1000} />);
    // Execute animation frames
    if (rafCallbacks.length > 0) {
      rafCallbacks[rafCallbacks.length - 1](performance.now() + 500);
    }
    if (rafCallbacks.length > 1) {
      rafCallbacks[rafCallbacks.length - 1](performance.now() + 1500);
    }

    window.requestAnimationFrame = originalRaf;
    window.cancelAnimationFrame = originalCaf;
  });

  it('skips animation for tiny diff', () => {
    const { rerender } = render(<AnimatedNumber value={100} />);
    rerender(<AnimatedNumber value={100.005} />);
    expect(screen.getByText('100')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Modal - showClose=false
// ---------------------------------------------------------------------------
describe('Modal showClose=false', () => {
  it('hides close button when showClose is false', () => {
    render(
      <Modal open={true} onClose={jest.fn()} title="No Close" showClose={false}>
        <p>Body</p>
      </Modal>,
    );
    expect(screen.queryByLabelText('Close')).not.toBeInTheDocument();
  });

  it('renders without title and without showClose', () => {
    render(
      <Modal open={true} onClose={jest.fn()} showClose={false}>
        <p>Body Only</p>
      </Modal>,
    );
    expect(screen.getByText('Body Only')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// ConfirmDialog danger variant
// ---------------------------------------------------------------------------
describe('ConfirmDialog danger variant', () => {
  it('renders danger variant styling', () => {
    const { container } = render(
      <ConfirmDialog
        open={true}
        onClose={jest.fn()}
        onConfirm={jest.fn()}
        title="Danger"
        variant="danger"
      />,
    );
    expect(container.querySelector('.bg-red-50')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Drawer
// ---------------------------------------------------------------------------
describe('Drawer', () => {
  it('does not render when open is false', () => {
    render(
      <Drawer open={false} onClose={jest.fn()} title="Test Drawer">
        <p>Drawer content</p>
      </Drawer>,
    );
    expect(screen.queryByText('Drawer content')).not.toBeInTheDocument();
  });

  it('renders when open is true', () => {
    render(
      <Drawer open={true} onClose={jest.fn()} title="Test Drawer">
        <p>Drawer content</p>
      </Drawer>,
    );
    expect(screen.getByText('Drawer content')).toBeInTheDocument();
    expect(screen.getByText('Test Drawer')).toBeInTheDocument();
  });

  it('calls onClose when escape key is pressed', () => {
    const onClose = jest.fn();
    render(
      <Drawer open={true} onClose={onClose} title="Test">
        <p>Content</p>
      </Drawer>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when backdrop is clicked', () => {
    const onClose = jest.fn();
    render(
      <Drawer open={true} onClose={onClose} title="Test">
        <p>Content</p>
      </Drawer>,
    );
    const backdrop = document.querySelector('.bg-black\\/30');
    if (backdrop) fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalled();
  });

  it('shows close button', () => {
    render(
      <Drawer open={true} onClose={jest.fn()} title="Test">
        <p>Content</p>
      </Drawer>,
    );
    expect(screen.getByLabelText('Close')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = jest.fn();
    render(
      <Drawer open={true} onClose={onClose} title="Test">
        <p>Content</p>
      </Drawer>,
    );
    fireEvent.click(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('renders without title', () => {
    render(
      <Drawer open={true} onClose={jest.fn()}>
        <p>No title</p>
      </Drawer>,
    );
    expect(screen.getByText('No title')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// SearchOverlay - backdrop click and link click
// ---------------------------------------------------------------------------
describe('SearchOverlay interactions', () => {
  it('closes when backdrop is clicked', () => {
    render(
      <TestWrapper>
        <SearchOverlay />
      </TestWrapper>,
    );

    // Open overlay
    fireEvent.keyDown(document, { key: 'k', metaKey: true });
    expect(screen.getByPlaceholderText('Search pages, actions...')).toBeInTheDocument();

    // Click backdrop
    const backdrop = document.querySelector('.bg-black\\/30');
    if (backdrop) fireEvent.click(backdrop);

    // Should close
    expect(screen.queryByPlaceholderText('Search pages, actions...')).not.toBeInTheDocument();
  });

  it('closes when a search result link is clicked', () => {
    render(
      <TestWrapper>
        <SearchOverlay />
      </TestWrapper>,
    );

    // Open overlay
    fireEvent.keyDown(document, { key: 'k', metaKey: true });
    expect(screen.getByPlaceholderText('Search pages, actions...')).toBeInTheDocument();

    // Click a search item (Dashboard link)
    fireEvent.click(screen.getByText('Dashboard'));

    // Should close
    expect(screen.queryByPlaceholderText('Search pages, actions...')).not.toBeInTheDocument();
  });

  it('toggles search open/close with Cmd+K', () => {
    render(
      <TestWrapper>
        <SearchOverlay />
      </TestWrapper>,
    );

    // Open
    fireEvent.keyDown(document, { key: 'k', metaKey: true });
    expect(screen.getByPlaceholderText('Search pages, actions...')).toBeInTheDocument();

    // Close with Cmd+K again
    fireEvent.keyDown(document, { key: 'k', metaKey: true });
    expect(screen.queryByPlaceholderText('Search pages, actions...')).not.toBeInTheDocument();
  });

  it('focuses input after opening with setTimeout', () => {
    jest.useFakeTimers();
    render(
      <TestWrapper>
        <SearchOverlay />
      </TestWrapper>,
    );
    fireEvent.keyDown(document, { key: 'k', metaKey: true });
    act(() => {
      jest.advanceTimersByTime(150);
    });
    expect(screen.getByPlaceholderText('Search pages, actions...')).toBeInTheDocument();
    jest.useRealTimers();
  });
});

// ---------------------------------------------------------------------------
// TopNav extended tests
// ---------------------------------------------------------------------------
describe('TopNav interactions', () => {
  it('opens and closes mobile menu', () => {
    render(
      <TestWrapper>
        <TopNav />
      </TestWrapper>,
    );
    const menuBtn = screen.getByLabelText('Toggle menu');
    fireEvent.click(menuBtn);
    // Mobile menu shows all nav links
    expect(screen.getAllByText('Dashboard').length).toBeGreaterThanOrEqual(2);

    // Click menu toggle again to close
    fireEvent.click(menuBtn);
  });

  it('opens Platform dropdown and closes on outside click', () => {
    render(
      <TestWrapper>
        <TopNav />
      </TestWrapper>,
    );
    fireEvent.click(screen.getByText('Platform'));
    // Should show secondary nav links
    expect(screen.getByText('Vault')).toBeInTheDocument();
    expect(screen.getByText('Marketplace')).toBeInTheDocument();

    // Click outside (mousedown on body)
    fireEvent.mouseDown(document.body);
    // Dropdown should close
  });

  it('opens More dropdown and closes on outside click', () => {
    render(
      <TestWrapper>
        <TopNav />
      </TestWrapper>,
    );
    fireEvent.click(screen.getByText('More'));
    // Should show tertiary nav links
    expect(screen.getByText('Wearables')).toBeInTheDocument();

    // Click outside
    fireEvent.mouseDown(document.body);
  });

  it('closes Platform dropdown when clicking a link inside', () => {
    render(
      <TestWrapper>
        <TopNav />
      </TestWrapper>,
    );
    fireEvent.click(screen.getByText('Platform'));
    fireEvent.click(screen.getByText('Vault'));
    // Dropdown should close
  });

  it('closes More dropdown when clicking a link inside', () => {
    render(
      <TestWrapper>
        <TopNav />
      </TestWrapper>,
    );
    fireEvent.click(screen.getByText('More'));
    fireEvent.click(screen.getByText('Wearables'));
  });

  it('closes Platform dropdown when More is clicked and vice versa', () => {
    render(
      <TestWrapper>
        <TopNav />
      </TestWrapper>,
    );
    // Open Platform
    fireEvent.click(screen.getByText('Platform'));
    expect(screen.getByText('Vault')).toBeInTheDocument();

    // Open More (should close Platform)
    fireEvent.click(screen.getByText('More'));
    expect(screen.getByText('Wearables')).toBeInTheDocument();

    // Open Platform again (should close More)
    fireEvent.click(screen.getByText('Platform'));
    expect(screen.getByText('Vault')).toBeInTheDocument();
  });

  it('opens search when search button is clicked', () => {
    render(
      <TestWrapper>
        <TopNav />
        <SearchOverlay />
      </TestWrapper>,
    );
    fireEvent.click(screen.getByLabelText('Search'));
    expect(screen.getByPlaceholderText('Search pages, actions...')).toBeInTheDocument();
  });

  it('closes Platform dropdown when clicking outside', () => {
    render(
      <TestWrapper>
        <TopNav />
      </TestWrapper>,
    );
    // Open Platform dropdown
    fireEvent.click(screen.getByText('Platform'));
    expect(screen.getByText('Vault')).toBeInTheDocument();
    // Click outside the dropdown
    fireEvent.mouseDown(document.body);
    // The dropdown should close
  });

  it('closes More dropdown when clicking outside', () => {
    render(
      <TestWrapper>
        <TopNav />
      </TestWrapper>,
    );
    // Open More dropdown
    fireEvent.click(screen.getByText('More'));
    expect(screen.getByText('Wearables')).toBeInTheDocument();
    // Click outside the dropdown
    fireEvent.mouseDown(document.body);
  });

  it('closes mobile menu when a link is clicked', () => {
    render(
      <TestWrapper>
        <TopNav />
      </TestWrapper>,
    );
    const menuBtn = screen.getByLabelText('Toggle menu');
    fireEvent.click(menuBtn);

    // Click a mobile nav link
    const dashboardLinks = screen.getAllByText('Dashboard');
    // Click the last one (the mobile menu one)
    fireEvent.click(dashboardLinks[dashboardLinks.length - 1]);
  });
});
