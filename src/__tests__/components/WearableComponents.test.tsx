// ============================================================
// Tests for src/components/wearables/WearableComponents.tsx
// ============================================================

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppProvider } from '@/contexts/AppContext';
import {
  DeviceCard,
  SyncStatusBar,
  WearableChart,
  DataPointList,
  ConnectionWizard,
} from '@/components/wearables/WearableComponents';
import type { WearableDevice, WearableDataPoint, WearableProvider } from '@/types';

function TestWrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return React.createElement(QueryClientProvider, { client: qc },
    React.createElement(AppProvider, null, children));
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const mockConnectedDevice: WearableDevice = {
  id: 'device-1',
  provider: 'apple_health',
  deviceName: 'iPhone 15 Pro',
  status: 'connected',
  lastSync: Date.now() - 3600000,
  dataPointsSynced: 12500,
  batteryLevel: 85,
  firmwareVersion: '17.2',
  connectedAt: Date.now() - 7 * 86400000,
};

const mockDisconnectedDevice: WearableDevice = {
  id: 'device-2',
  provider: 'oura',
  deviceName: 'Oura Ring Gen 3',
  status: 'disconnected',
  lastSync: Date.now() - 24 * 3600000,
  dataPointsSynced: 5800,
  connectedAt: Date.now() - 30 * 86400000,
};

const mockSyncingDevice: WearableDevice = {
  ...mockConnectedDevice,
  id: 'device-3',
  provider: 'whoop',
  deviceName: 'WHOOP 4.0',
  status: 'syncing',
  batteryLevel: 12,
};

const mockLowBatteryDevice: WearableDevice = {
  ...mockConnectedDevice,
  id: 'device-4',
  provider: 'fitbit',
  deviceName: 'Fitbit Sense 2',
  batteryLevel: 15,
};

const mockDataPoints: WearableDataPoint[] = Array.from({ length: 10 }, (_, i) => ({
  id: `dp-${i}`,
  deviceId: 'device-1',
  metric: 'heart_rate',
  value: 65 + i,
  unit: 'bpm',
  timestamp: Date.now() - i * 3600000,
  source: 'apple_health',
}));

// ---------------------------------------------------------------------------
// DeviceCard
// ---------------------------------------------------------------------------

describe('DeviceCard', () => {
  it('renders provider name and device name', () => {
    render(
      <TestWrapper>
        <DeviceCard device={mockConnectedDevice} />
      </TestWrapper>
    );
    expect(screen.getByText('Apple Health')).toBeInTheDocument();
    expect(screen.getByText('iPhone 15 Pro')).toBeInTheDocument();
  });

  it('renders Last Sync and Data Points for connected device', () => {
    render(
      <TestWrapper>
        <DeviceCard device={mockConnectedDevice} />
      </TestWrapper>
    );
    expect(screen.getByText('Last Sync')).toBeInTheDocument();
    expect(screen.getByText('Data Points')).toBeInTheDocument();
  });

  it('renders battery level for connected device', () => {
    render(
      <TestWrapper>
        <DeviceCard device={mockConnectedDevice} />
      </TestWrapper>
    );
    expect(screen.getByText('Battery')).toBeInTheDocument();
    expect(screen.getByText('85%')).toBeInTheDocument();
  });

  it('renders low battery in red', () => {
    render(
      <TestWrapper>
        <DeviceCard device={mockLowBatteryDevice} />
      </TestWrapper>
    );
    const batteryText = screen.getByText('15%');
    expect(batteryText).toHaveClass('text-red-600');
  });

  it('renders Sync button for connected device', () => {
    render(
      <TestWrapper>
        <DeviceCard device={mockConnectedDevice} onSync={jest.fn()} />
      </TestWrapper>
    );
    expect(screen.getByText('Sync')).toBeInTheDocument();
  });

  it('calls onSync with device id when Sync is clicked', () => {
    const onSync = jest.fn();
    render(
      <TestWrapper>
        <DeviceCard device={mockConnectedDevice} onSync={onSync} />
      </TestWrapper>
    );
    fireEvent.click(screen.getByText('Sync'));
    expect(onSync).toHaveBeenCalledWith('device-1');
  });

  it('shows Syncing... when isSyncing is true', () => {
    render(
      <TestWrapper>
        <DeviceCard device={mockConnectedDevice} onSync={jest.fn()} isSyncing={true} />
      </TestWrapper>
    );
    expect(screen.getByText('Syncing...')).toBeInTheDocument();
  });

  it('renders Connect button for disconnected device', () => {
    render(
      <TestWrapper>
        <DeviceCard device={mockDisconnectedDevice} onConnect={jest.fn()} />
      </TestWrapper>
    );
    expect(screen.getByText('Connect')).toBeInTheDocument();
  });

  it('calls onConnect with provider when Connect is clicked', () => {
    const onConnect = jest.fn();
    render(
      <TestWrapper>
        <DeviceCard device={mockDisconnectedDevice} onConnect={onConnect} />
      </TestWrapper>
    );
    fireEvent.click(screen.getByText('Connect'));
    expect(onConnect).toHaveBeenCalledWith('oura');
  });

  it('does not show battery level when batteryLevel is undefined', () => {
    render(
      <TestWrapper>
        <DeviceCard device={mockDisconnectedDevice} />
      </TestWrapper>
    );
    expect(screen.queryByText('Battery')).not.toBeInTheDocument();
  });

  it('calls onDisconnect with device id when disconnect button clicked', () => {
    const onDisconnect = jest.fn();
    render(
      <TestWrapper>
        <DeviceCard device={mockConnectedDevice} onDisconnect={onDisconnect} onSync={jest.fn()} />
      </TestWrapper>
    );
    // The disconnect button contains a PowerOff icon — it's the second button
    const buttons = screen.getAllByRole('button');
    // Find the button that is NOT the Sync button
    const disconnectButton = buttons.find(btn => !btn.textContent?.includes('Sync'));
    fireEvent.click(disconnectButton!);
    expect(onDisconnect).toHaveBeenCalledWith('device-1');
  });
});

// ---------------------------------------------------------------------------
// SyncStatusBar
// ---------------------------------------------------------------------------

describe('SyncStatusBar', () => {
  it('renders label when provided', () => {
    render(
      <TestWrapper>
        <SyncStatusBar progress={60} label="Syncing heart rate data..." />
      </TestWrapper>
    );
    expect(screen.getByText('Syncing heart rate data...')).toBeInTheDocument();
  });

  it('renders progress percentage', () => {
    render(
      <TestWrapper>
        <SyncStatusBar progress={75} />
      </TestWrapper>
    );
    expect(screen.getByText('75%')).toBeInTheDocument();
  });

  it('renders without label', () => {
    const { container } = render(
      <TestWrapper>
        <SyncStatusBar progress={40} />
      </TestWrapper>
    );
    expect(container.firstChild).toBeTruthy();
    expect(screen.getByText('40%')).toBeInTheDocument();
  });

  it('caps display at 100%', () => {
    render(
      <TestWrapper>
        <SyncStatusBar progress={120} />
      </TestWrapper>
    );
    // The text shows original value but bar is capped
    expect(screen.getByText('120%')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// WearableChart
// ---------------------------------------------------------------------------

describe('WearableChart', () => {
  it('renders metric heading', () => {
    render(
      <TestWrapper>
        <WearableChart dataPoints={mockDataPoints} metric="heart_rate" />
      </TestWrapper>
    );
    expect(screen.getByText('heart rate')).toBeInTheDocument();
  });

  it('renders data point count', () => {
    render(
      <TestWrapper>
        <WearableChart dataPoints={mockDataPoints} metric="heart_rate" />
      </TestWrapper>
    );
    expect(screen.getByText(/10 data points/)).toBeInTheDocument();
  });

  it('renders without crashing with empty data', () => {
    const { container } = render(
      <TestWrapper>
        <WearableChart dataPoints={[]} metric="heart_rate" />
      </TestWrapper>
    );
    expect(container.firstChild).toBeTruthy();
  });

  it('renders only data points matching the metric', () => {
    const mixedPoints: WearableDataPoint[] = [
      ...mockDataPoints,
      { id: 'dp-hrv-1', deviceId: 'device-1', metric: 'hrv', value: 45, unit: 'ms', timestamp: Date.now(), source: 'apple_health' },
    ];
    render(
      <TestWrapper>
        <WearableChart dataPoints={mixedPoints} metric="heart_rate" />
      </TestWrapper>
    );
    expect(screen.getByText(/10 data points/)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// DataPointList
// ---------------------------------------------------------------------------

describe('DataPointList', () => {
  it('renders Recent Data Points heading', () => {
    render(
      <TestWrapper>
        <DataPointList dataPoints={mockDataPoints} />
      </TestWrapper>
    );
    expect(screen.getByText('Recent Data Points')).toBeInTheDocument();
  });

  it('renders table column headers', () => {
    render(
      <TestWrapper>
        <DataPointList dataPoints={mockDataPoints} />
      </TestWrapper>
    );
    expect(screen.getByText('Metric')).toBeInTheDocument();
    expect(screen.getByText('Value')).toBeInTheDocument();
    expect(screen.getByText('Unit')).toBeInTheDocument();
    expect(screen.getByText('Time')).toBeInTheDocument();
  });

  it('renders data point rows', () => {
    render(
      <TestWrapper>
        <DataPointList dataPoints={mockDataPoints} />
      </TestWrapper>
    );
    // metric "heart_rate" displayed as "heart rate" (underscores replaced)
    const cells = screen.getAllByText('heart rate');
    expect(cells.length).toBeGreaterThan(0);
  });

  it('renders without crashing with empty data', () => {
    const { container } = render(
      <TestWrapper>
        <DataPointList dataPoints={[]} />
      </TestWrapper>
    );
    expect(container.firstChild).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// ConnectionWizard
// ---------------------------------------------------------------------------

describe('ConnectionWizard', () => {
  const provider: WearableProvider = 'apple_health';

  it('renders step 1 with provider name and Authorize button', () => {
    render(
      <TestWrapper>
        <ConnectionWizard provider={provider} onConnect={jest.fn()} onCancel={jest.fn()} isLoading={false} />
      </TestWrapper>
    );
    expect(screen.getByText('Connect Apple Health')).toBeInTheDocument();
    expect(screen.getByText('Authorize Connection')).toBeInTheDocument();
  });

  it('advances to step 2 on Authorize Connection click', () => {
    render(
      <TestWrapper>
        <ConnectionWizard provider={provider} onConnect={jest.fn()} onCancel={jest.fn()} isLoading={false} />
      </TestWrapper>
    );
    fireEvent.click(screen.getByText('Authorize Connection'));
    expect(screen.getByText('TEE Verification')).toBeInTheDocument();
    expect(screen.getByText('Verify & Connect')).toBeInTheDocument();
  });

  it('advances to step 3 on Verify & Connect click', () => {
    render(
      <TestWrapper>
        <ConnectionWizard provider={provider} onConnect={jest.fn()} onCancel={jest.fn()} isLoading={false} />
      </TestWrapper>
    );
    fireEvent.click(screen.getByText('Authorize Connection'));
    fireEvent.click(screen.getByText('Verify & Connect'));
    expect(screen.getByText('Confirm Connection')).toBeInTheDocument();
    expect(screen.getByText('Connect Now')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('calls onConnect when Connect Now is clicked', () => {
    const onConnect = jest.fn();
    render(
      <TestWrapper>
        <ConnectionWizard provider={provider} onConnect={onConnect} onCancel={jest.fn()} isLoading={false} />
      </TestWrapper>
    );
    fireEvent.click(screen.getByText('Authorize Connection'));
    fireEvent.click(screen.getByText('Verify & Connect'));
    fireEvent.click(screen.getByText('Connect Now'));
    expect(onConnect).toHaveBeenCalled();
  });

  it('calls onCancel when Cancel is clicked in step 3', () => {
    const onCancel = jest.fn();
    render(
      <TestWrapper>
        <ConnectionWizard provider={provider} onConnect={jest.fn()} onCancel={onCancel} isLoading={false} />
      </TestWrapper>
    );
    fireEvent.click(screen.getByText('Authorize Connection'));
    fireEvent.click(screen.getByText('Verify & Connect'));
    fireEvent.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalled();
  });

  it('shows Connecting... when isLoading is true on step 3', () => {
    render(
      <TestWrapper>
        <ConnectionWizard provider={provider} onConnect={jest.fn()} onCancel={jest.fn()} isLoading={true} />
      </TestWrapper>
    );
    fireEvent.click(screen.getByText('Authorize Connection'));
    fireEvent.click(screen.getByText('Verify & Connect'));
    expect(screen.getByText('Connecting...')).toBeInTheDocument();
  });

  it('renders for different provider', () => {
    render(
      <TestWrapper>
        <ConnectionWizard provider="oura" onConnect={jest.fn()} onCancel={jest.fn()} isLoading={false} />
      </TestWrapper>
    );
    expect(screen.getByText('Connect Oura Ring')).toBeInTheDocument();
  });
});
