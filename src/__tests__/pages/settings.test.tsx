// ============================================================
// Tests for src/app/settings/page.tsx
// ============================================================

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { AppProvider } from '@/contexts/AppContext';
import SettingsPage from '@/app/settings/page';

function TestWrapper({ children }: { children: React.ReactNode }) {
  return <AppProvider>{children}</AppProvider>;
}

describe('SettingsPage', () => {
  it('renders the page heading', () => {
    render(
      <TestWrapper>
        <SettingsPage />
      </TestWrapper>
    );
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('renders the page description', () => {
    render(
      <TestWrapper>
        <SettingsPage />
      </TestWrapper>
    );
    expect(
      screen.getByText(/Manage your account, privacy, security, and platform preferences/)
    ).toBeInTheDocument();
  });

  it('renders navigation', () => {
    render(
      <TestWrapper>
        <SettingsPage />
      </TestWrapper>
    );
    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument();
  });

  it('renders footer', () => {
    render(
      <TestWrapper>
        <SettingsPage />
      </TestWrapper>
    );
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });

  it('renders settings sidebar navigation', () => {
    render(
      <TestWrapper>
        <SettingsPage />
      </TestWrapper>
    );
    expect(screen.getByRole('navigation', { name: 'Settings navigation' })).toBeInTheDocument();
  });

  it('renders all settings tabs in sidebar', () => {
    render(
      <TestWrapper>
        <SettingsPage />
      </TestWrapper>
    );
    expect(screen.getAllByText('Profile').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Security').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Privacy').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Notifications').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Connected Apps').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Data Export').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Network').length).toBeGreaterThanOrEqual(1);
  });

  it('renders Profile tab by default with Personal Information', () => {
    render(
      <TestWrapper>
        <SettingsPage />
      </TestWrapper>
    );
    expect(screen.getByText('Personal Information')).toBeInTheDocument();
    expect(screen.getByText('Display Name')).toBeInTheDocument();
    expect(screen.getByText('Email Address')).toBeInTheDocument();
    expect(screen.getByText('Bio')).toBeInTheDocument();
  });

  it('renders Wallet Address section on Profile tab', () => {
    render(
      <TestWrapper>
        <SettingsPage />
      </TestWrapper>
    );
    expect(screen.getByText('Wallet Address')).toBeInTheDocument();
  });

  it('renders Save Changes button on Profile tab', () => {
    render(
      <TestWrapper>
        <SettingsPage />
      </TestWrapper>
    );
    expect(screen.getByText('Save Changes')).toBeInTheDocument();
  });

  it('switches to Security tab and shows 2FA and password sections', () => {
    render(
      <TestWrapper>
        <SettingsPage />
      </TestWrapper>
    );
    const securityButtons = screen.getAllByText('Security');
    fireEvent.click(securityButtons[securityButtons.length - 1]);
    expect(screen.getByText('Two-Factor Authentication')).toBeInTheDocument();
    expect(screen.getByText('Change Password')).toBeInTheDocument();
    expect(screen.getByText('Active Sessions')).toBeInTheDocument();
  });

  it('switches to Privacy tab and shows data sharing preferences', () => {
    render(
      <TestWrapper>
        <SettingsPage />
      </TestWrapper>
    );
    const privacyButtons = screen.getAllByText('Privacy');
    fireEvent.click(privacyButtons[privacyButtons.length - 1]);
    expect(screen.getByText('Data Sharing Preferences')).toBeInTheDocument();
    expect(screen.getByText('Share with Healthcare Providers')).toBeInTheDocument();
    expect(screen.getByText('Anonymous Research Contribution')).toBeInTheDocument();
    expect(screen.getByText('Cookie Preferences')).toBeInTheDocument();
    expect(screen.getByText('Your Privacy Matters')).toBeInTheDocument();
  });

  it('switches to Notifications tab and shows notification settings', () => {
    render(
      <TestWrapper>
        <SettingsPage />
      </TestWrapper>
    );
    const notifButtons = screen.getAllByText('Notifications');
    fireEvent.click(notifButtons[notifButtons.length - 1]);
    expect(screen.getByText('Notification Channels')).toBeInTheDocument();
    expect(screen.getByText('Notification Frequency')).toBeInTheDocument();
    expect(screen.getByText('Notification Types')).toBeInTheDocument();
    expect(screen.getByText('Access Alerts')).toBeInTheDocument();
    expect(screen.getByText('Security Alerts')).toBeInTheDocument();
  });

  it('switches to Connected Apps tab and shows connected applications', () => {
    render(
      <TestWrapper>
        <SettingsPage />
      </TestWrapper>
    );
    const connectedButtons = screen.getAllByText('Connected Apps');
    fireEvent.click(connectedButtons[connectedButtons.length - 1]);
    expect(screen.getByText('Connected Applications')).toBeInTheDocument();
    expect(screen.getByText('Connect App')).toBeInTheDocument();
    expect(screen.getByText('Secure Connections')).toBeInTheDocument();
  });

  it('switches to Data Export tab and shows export options', () => {
    render(
      <TestWrapper>
        <SettingsPage />
      </TestWrapper>
    );
    const exportButtons = screen.getAllByText('Data Export');
    fireEvent.click(exportButtons[exportButtons.length - 1]);
    expect(screen.getByText('Export Health Data')).toBeInTheDocument();
    expect(screen.getByText('JSON Format')).toBeInTheDocument();
    expect(screen.getByText('CSV Format')).toBeInTheDocument();
    expect(screen.getByText('Data Summary')).toBeInTheDocument();
    expect(screen.getByText('Danger Zone')).toBeInTheDocument();
    expect(screen.getAllByText('Delete Account').length).toBeGreaterThanOrEqual(1);
  });

  it('switches to Network tab and shows RPC configuration', () => {
    render(
      <TestWrapper>
        <SettingsPage />
      </TestWrapper>
    );
    const networkButtons = screen.getAllByText('Network');
    fireEvent.click(networkButtons[networkButtons.length - 1]);
    expect(screen.getByText('RPC Endpoint Configuration')).toBeInTheDocument();
    expect(screen.getByText('TEE Enclave Preferences')).toBeInTheDocument();
    expect(screen.getByText('Network Status')).toBeInTheDocument();
    expect(screen.getByText('Save Network Settings')).toBeInTheDocument();
  });

  // ---- Profile tab: form input interactions ----

  it('updates display name via text input onChange', () => {
    render(
      <TestWrapper>
        <SettingsPage />
      </TestWrapper>
    );
    const nameInput = screen.getByLabelText('Display Name') as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: 'New Name' } });
    expect(nameInput.value).toBe('New Name');
  });

  it('updates email via text input onChange', () => {
    render(
      <TestWrapper>
        <SettingsPage />
      </TestWrapper>
    );
    const emailInput = screen.getByLabelText('Email Address') as HTMLInputElement;
    fireEvent.change(emailInput, { target: { value: 'new@example.com' } });
    expect(emailInput.value).toBe('new@example.com');
  });

  it('updates bio via textarea onChange', () => {
    render(
      <TestWrapper>
        <SettingsPage />
      </TestWrapper>
    );
    const bioInput = screen.getByLabelText('Bio') as HTMLTextAreaElement;
    fireEvent.change(bioInput, { target: { value: 'New bio text' } });
    expect(bioInput.value).toBe('New bio text');
  });

  // ---- Security tab: toggle and modal interactions ----

  it('opens 2FA modal and enables 2FA via the enable button', () => {
    render(
      <TestWrapper>
        <SettingsPage />
      </TestWrapper>
    );
    const securityButtons = screen.getAllByText('Security');
    fireEvent.click(securityButtons[securityButtons.length - 1]);

    // 2FA is disabled initially, click the setup button
    fireEvent.click(screen.getByText('Set Up Two-Factor Authentication'));

    // Modal should open with QR code content
    expect(screen.getByText('Set Up 2FA')).toBeInTheDocument();
    expect(screen.getByText(/Scan this QR code/)).toBeInTheDocument();
    expect(screen.getByText('JBSWY3DPEHPK3PXP')).toBeInTheDocument();
    expect(screen.getByText('Verification Code')).toBeInTheDocument();

    // Click Enable 2FA button
    fireEvent.click(screen.getByText('Enable 2FA'));

    // After enabling, 2FA is active
    expect(screen.getByText('2FA is active')).toBeInTheDocument();
    expect(screen.getByText('Enabled')).toBeInTheDocument();
  });

  it('updates password fields on Security tab', () => {
    render(
      <TestWrapper>
        <SettingsPage />
      </TestWrapper>
    );
    const securityButtons = screen.getAllByText('Security');
    fireEvent.click(securityButtons[securityButtons.length - 1]);

    const currentPw = screen.getByLabelText('Current Password') as HTMLInputElement;
    const newPw = screen.getByLabelText('New Password') as HTMLInputElement;
    const confirmPw = screen.getByLabelText('Confirm New Password') as HTMLInputElement;

    fireEvent.change(currentPw, { target: { value: 'old123' } });
    fireEvent.change(newPw, { target: { value: 'new456' } });
    fireEvent.change(confirmPw, { target: { value: 'new456' } });

    expect(currentPw.value).toBe('old123');
    expect(newPw.value).toBe('new456');
    expect(confirmPw.value).toBe('new456');
  });

  // ---- Privacy tab: toggle interactions ----

  it('toggles privacy switches on Privacy tab', () => {
    render(
      <TestWrapper>
        <SettingsPage />
      </TestWrapper>
    );
    const privacyButtons = screen.getAllByText('Privacy');
    fireEvent.click(privacyButtons[privacyButtons.length - 1]);

    // Toggle "Analytics Data" switch (initially off)
    const analyticsSwitch = screen.getByRole('switch', { name: 'Analytics Data' });
    fireEvent.click(analyticsSwitch);
    expect(analyticsSwitch).toHaveAttribute('aria-checked', 'true');

    // Toggle "Feature Usage Data" switch (initially off)
    const usageSwitch = screen.getByRole('switch', { name: 'Feature Usage Data' });
    fireEvent.click(usageSwitch);
    expect(usageSwitch).toHaveAttribute('aria-checked', 'true');

    // Toggle "Crash Reports" switch (initially on)
    const crashSwitch = screen.getByRole('switch', { name: 'Crash Reports' });
    fireEvent.click(crashSwitch);
    expect(crashSwitch).toHaveAttribute('aria-checked', 'false');

    // Toggle cookie switches
    const analyticsCookiesSwitch = screen.getByRole('switch', { name: 'Analytics Cookies' });
    fireEvent.click(analyticsCookiesSwitch);
    expect(analyticsCookiesSwitch).toHaveAttribute('aria-checked', 'true');

    const marketingCookiesSwitch = screen.getByRole('switch', { name: 'Marketing Cookies' });
    fireEvent.click(marketingCookiesSwitch);
    expect(marketingCookiesSwitch).toHaveAttribute('aria-checked', 'true');

    // Toggle data sharing switches
    const providersSwitch = screen.getByRole('switch', { name: 'Share with Healthcare Providers' });
    fireEvent.click(providersSwitch);
    expect(providersSwitch).toHaveAttribute('aria-checked', 'false');

    const researchSwitch = screen.getByRole('switch', { name: 'Anonymous Research Contribution' });
    fireEvent.click(researchSwitch);
    expect(researchSwitch).toHaveAttribute('aria-checked', 'true');
  });

  // ---- Notifications tab: toggle and select interactions ----

  it('toggles notification switches and changes frequency', () => {
    render(
      <TestWrapper>
        <SettingsPage />
      </TestWrapper>
    );
    const notifButtons = screen.getAllByText('Notifications');
    fireEvent.click(notifButtons[notifButtons.length - 1]);

    // Toggle email notifications (initially on)
    const emailSwitch = screen.getByRole('switch', { name: 'Email Notifications' });
    fireEvent.click(emailSwitch);
    expect(emailSwitch).toHaveAttribute('aria-checked', 'false');

    // Toggle push notifications (initially on)
    const pushSwitch = screen.getByRole('switch', { name: 'Push Notifications' });
    fireEvent.click(pushSwitch);
    expect(pushSwitch).toHaveAttribute('aria-checked', 'false');

    // Change frequency via select
    const frequencySelect = screen.getByLabelText(/How often should we send/) as HTMLSelectElement;
    fireEvent.change(frequencySelect, { target: { value: 'daily' } });
    expect(frequencySelect.value).toBe('daily');

    // Toggle notification type switches
    const accessSwitch = screen.getByRole('switch', { name: 'Access Alerts' });
    fireEvent.click(accessSwitch);
    expect(accessSwitch).toHaveAttribute('aria-checked', 'false');

    const recordSwitch = screen.getByRole('switch', { name: 'Record Upload Confirmations' });
    fireEvent.click(recordSwitch);
    expect(recordSwitch).toHaveAttribute('aria-checked', 'false');

    const insightSwitch = screen.getByRole('switch', { name: 'AI Insight Ready' });
    fireEvent.click(insightSwitch);
    expect(insightSwitch).toHaveAttribute('aria-checked', 'false');

    const weeklySwitch = screen.getByRole('switch', { name: 'Weekly Health Summary' });
    fireEvent.click(weeklySwitch);
    expect(weeklySwitch).toHaveAttribute('aria-checked', 'false');

    const securitySwitch = screen.getByRole('switch', { name: 'Security Alerts' });
    fireEvent.click(securitySwitch);
    expect(securitySwitch).toHaveAttribute('aria-checked', 'false');

    const marketingSwitch = screen.getByRole('switch', { name: 'Product Updates' });
    fireEvent.click(marketingSwitch);
    expect(marketingSwitch).toHaveAttribute('aria-checked', 'true');
  });

  // ---- Data Export tab: format selection, export, and delete confirm ----

  it('closes 2FA modal via the modal close button', () => {
    render(
      <TestWrapper>
        <SettingsPage />
      </TestWrapper>
    );
    const securityButtons = screen.getAllByText('Security');
    fireEvent.click(securityButtons[securityButtons.length - 1]);

    // Open 2FA modal
    fireEvent.click(screen.getByText('Set Up Two-Factor Authentication'));
    expect(screen.getByText('Set Up 2FA')).toBeInTheDocument();

    // Close the modal via the close button (X) which triggers onClose
    const closeButton = screen.getByLabelText('Close');
    fireEvent.click(closeButton);

    // The 2FA setup button should still be visible (modal closed without enabling)
    expect(screen.getByText('Set Up Two-Factor Authentication')).toBeInTheDocument();
  });

  it('selects JSON format explicitly after switching to CSV on Data Export tab', () => {
    render(
      <TestWrapper>
        <SettingsPage />
      </TestWrapper>
    );
    const exportButtons = screen.getAllByText('Data Export');
    fireEvent.click(exportButtons[exportButtons.length - 1]);

    // Switch to CSV first
    fireEvent.click(screen.getByText('CSV Format'));
    expect(screen.getByText(/Export as CSV/)).toBeInTheDocument();

    // Switch back to JSON to cover the JSON onClick handler
    fireEvent.click(screen.getByText('JSON Format'));
    expect(screen.getByText(/Export as JSON/)).toBeInTheDocument();
  });

  it('selects CSV format and starts export on Data Export tab', () => {
    render(
      <TestWrapper>
        <SettingsPage />
      </TestWrapper>
    );
    const exportButtons = screen.getAllByText('Data Export');
    fireEvent.click(exportButtons[exportButtons.length - 1]);

    // Click CSV format button
    fireEvent.click(screen.getByText('CSV Format'));

    // The export button should now say "Export as CSV"
    expect(screen.getByText(/Export as CSV/)).toBeInTheDocument();

    // Click the export button
    fireEvent.click(screen.getByText(/Export as CSV/));

    // After clicking, it should show "Preparing Export..."
    expect(screen.getByText(/Preparing Export/)).toBeInTheDocument();
  });

  it('opens and closes the delete account confirm dialog', () => {
    render(
      <TestWrapper>
        <SettingsPage />
      </TestWrapper>
    );
    const exportButtons = screen.getAllByText('Data Export');
    fireEvent.click(exportButtons[exportButtons.length - 1]);

    // Click the Delete Account button in the danger zone
    const deleteButtons = screen.getAllByText('Delete Account');
    // The button (not the heading) triggers the confirm dialog
    fireEvent.click(deleteButtons[deleteButtons.length - 1]);

    // The confirm dialog should appear
    expect(screen.getByText('Delete Account?')).toBeInTheDocument();
    expect(screen.getByText(/This will permanently delete/)).toBeInTheDocument();
    expect(screen.getByText('Delete Everything')).toBeInTheDocument();

    // Confirm the deletion (which just closes the dialog)
    fireEvent.click(screen.getByText('Delete Everything'));

    // Dialog should close
    expect(screen.queryByText('Delete Account?')).not.toBeInTheDocument();
  });

  // ---- Network tab: input interactions and TEE platform selection ----

  it('updates RPC, WebSocket, and gas price fields on Network tab', () => {
    render(
      <TestWrapper>
        <SettingsPage />
      </TestWrapper>
    );
    const networkButtons = screen.getAllByText('Network');
    fireEvent.click(networkButtons[networkButtons.length - 1]);

    const rpcInput = screen.getByLabelText('RPC Endpoint') as HTMLInputElement;
    fireEvent.change(rpcInput, { target: { value: 'https://custom-rpc.example.com' } });
    expect(rpcInput.value).toBe('https://custom-rpc.example.com');

    const wsInput = screen.getByLabelText('WebSocket Endpoint') as HTMLInputElement;
    fireEvent.change(wsInput, { target: { value: 'wss://custom-ws.example.com' } });
    expect(wsInput.value).toBe('wss://custom-ws.example.com');

    const gasSelect = screen.getByLabelText('Gas Price Strategy') as HTMLSelectElement;
    fireEvent.change(gasSelect, { target: { value: 'high' } });
    expect(gasSelect.value).toBe('high');
  });

  it('selects a different TEE platform on Network tab', () => {
    render(
      <TestWrapper>
        <SettingsPage />
      </TestWrapper>
    );
    const networkButtons = screen.getAllByText('Network');
    fireEvent.click(networkButtons[networkButtons.length - 1]);

    // Click on "AWS Nitro" platform button
    fireEvent.click(screen.getByText('AWS Nitro'));

    // The active badge should now show "AWS Nitro Active"
    expect(screen.getByText('AWS Nitro Active')).toBeInTheDocument();

    // Click on "AMD SEV" platform button
    fireEvent.click(screen.getByText('AMD SEV'));
    expect(screen.getByText('AMD SEV Active')).toBeInTheDocument();
  });

  it('renders wallet connected state on Profile tab when wallet is connected', () => {
    // Set localStorage to simulate a connected wallet
    const walletData = {
      connected: true,
      address: 'aeth1qz5k7x8r3f2h9n4m6w0j1t5v8c3b7g2p9d4l6s',
      aethelBalance: 1250.5,
      provider: 'keplr',
      chainId: 'aethelred-1',
    };
    localStorage.setItem('shiora_wallet', JSON.stringify(walletData));

    render(
      <TestWrapper>
        <SettingsPage />
      </TestWrapper>
    );

    // Should show the connected wallet address and badges
    expect(screen.getByText('Connected')).toBeInTheDocument();
    expect(screen.getByText('Aethelred Mainnet')).toBeInTheDocument();

    // Clean up
    localStorage.removeItem('shiora_wallet');
  });

  it('interacts with essential cookies toggle (no-op onChange)', () => {
    render(
      <TestWrapper>
        <SettingsPage />
      </TestWrapper>
    );
    const privacyButtons = screen.getAllByText('Privacy');
    fireEvent.click(privacyButtons[privacyButtons.length - 1]);

    // Essential Cookies toggle has onChange={() => {}} — clicking it should not throw
    const essentialSwitch = screen.getByRole('switch', { name: 'Essential Cookies' });
    fireEvent.click(essentialSwitch);
    // It should remain enabled since onChange is a no-op
    expect(essentialSwitch).toHaveAttribute('aria-checked', 'true');
  });

  it('types in the 2FA verification code field (no-op onChange)', () => {
    render(
      <TestWrapper>
        <SettingsPage />
      </TestWrapper>
    );
    const securityButtons = screen.getAllByText('Security');
    fireEvent.click(securityButtons[securityButtons.length - 1]);

    // Open 2FA modal
    fireEvent.click(screen.getByText('Set Up Two-Factor Authentication'));

    // The 2FA code input has onChange={() => {}} — typing should not throw
    const codeInput = screen.getByPlaceholderText('Enter 6-digit code');
    fireEvent.change(codeInput, { target: { value: '123456' } });
    // Value won't actually change since onChange is no-op
    expect(codeInput).toBeInTheDocument();
  });

  it('toggles auto-switch TEE platform on Network tab', () => {
    render(
      <TestWrapper>
        <SettingsPage />
      </TestWrapper>
    );
    const networkButtons = screen.getAllByText('Network');
    fireEvent.click(networkButtons[networkButtons.length - 1]);

    const autoSwitch = screen.getByRole('switch', { name: 'Auto-switch TEE Platform' });
    // Initially enabled
    expect(autoSwitch).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(autoSwitch);
    expect(autoSwitch).toHaveAttribute('aria-checked', 'false');
  });
});
