describe('hooks barrel export', () => {
  it('exports all hooks', () => {
    const hooks = require('@/hooks');
    expect(hooks).toBeDefined();
    expect(typeof hooks.useAccessControl).toBe('function');
    expect(typeof hooks.useDigitalTwin).toBe('function');
    expect(typeof hooks.useHealthRecords).toBe('function');
    expect(typeof hooks.useLocalStorage).toBe('function');
    expect(typeof hooks.useNotifications).toBe('function');
    expect(typeof hooks.useIPFS).toBe('function');
    expect(typeof hooks.useGovernance).toBe('function');
    expect(typeof hooks.useMarketplace).toBe('function');
    expect(typeof hooks.usePredictiveAlerts).toBe('function');
    expect(typeof hooks.useReproductiveVault).toBe('function');
    expect(typeof hooks.useTEEExplorer).toBe('function');
    expect(typeof hooks.useHealthChat).toBe('function');
    expect(typeof hooks.useConsentManagement).toBe('function');
  });
});
