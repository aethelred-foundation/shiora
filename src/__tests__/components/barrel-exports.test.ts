/**
 * Barrel export coverage tests.
 * Each test simply imports the barrel module to ensure it loads without error
 * and reports coverage for the index.ts re-export files.
 */

describe('component barrel exports', () => {
  it('exports ui components', () => {
    const mod = require('@/components/ui');
    expect(mod).toBeDefined();
  });

  it('exports layout components', () => {
    const mod = require('@/components/layout');
    expect(mod).toBeDefined();
  });

  it('exports modals components', () => {
    const mod = require('@/components/modals');
    expect(mod).toBeDefined();
  });

  it('exports chat components', () => {
    const mod = require('@/components/chat');
    expect(mod).toBeDefined();
  });

  it('exports vault components', () => {
    const mod = require('@/components/vault');
    expect(mod).toBeDefined();
  });

  it('exports consent components', () => {
    const mod = require('@/components/consent');
    expect(mod).toBeDefined();
    expect(mod.ConsentTab).toBeDefined();
  });

  it('exports marketplace components', () => {
    const mod = require('@/components/marketplace');
    expect(mod).toBeDefined();
  });

  it('exports governance components', () => {
    const mod = require('@/components/governance');
    expect(mod).toBeDefined();
  });

  it('exports wearables components', () => {
    const mod = require('@/components/wearables');
    expect(mod).toBeDefined();
  });

  it('exports alerts components', () => {
    const mod = require('@/components/alerts');
    expect(mod).toBeDefined();
  });

  it('exports fhir components', () => {
    const mod = require('@/components/fhir');
    expect(mod).toBeDefined();
  });

  it('exports zkp components', () => {
    const mod = require('@/components/zkp');
    expect(mod).toBeDefined();
  });

  it('exports community components', () => {
    const mod = require('@/components/community');
    expect(mod).toBeDefined();
  });

  it('exports research components', () => {
    const mod = require('@/components/research');
    expect(mod).toBeDefined();
  });

  it('exports rewards components', () => {
    const mod = require('@/components/rewards');
    expect(mod).toBeDefined();
  });

  it('exports reputation components', () => {
    const mod = require('@/components/reputation');
    expect(mod).toBeDefined();
    expect(mod.ReputationScore).toBeDefined();
    expect(mod.StarRating).toBeDefined();
    expect(mod.ReviewCard).toBeDefined();
    expect(mod.TrustBadge).toBeDefined();
    expect(mod.ReputationHistory).toBeDefined();
    expect(mod.ProviderProfile).toBeDefined();
    expect(mod.ReputationTab).toBeDefined();
  });

  it('exports xai components', () => {
    const mod = require('@/components/xai');
    expect(mod).toBeDefined();
    expect(mod.SHAPWaterfall).toBeDefined();
    expect(mod.FeatureImportanceChart).toBeDefined();
    expect(mod.ModelCardViewer).toBeDefined();
    expect(mod.BiasHeatmap).toBeDefined();
    expect(mod.DecisionPath).toBeDefined();
    expect(mod.ExplainabilityTab).toBeDefined();
  });

  it('exports privacy components', () => {
    const mod = require('@/components/privacy');
    expect(mod).toBeDefined();
  });

  it('exports all components from root barrel', () => {
    const mod = require('@/components');
    expect(mod).toBeDefined();
  });
});
