// ============================================================
// Tests for src/lib/constants.ts
// ============================================================

import {
  BRAND,
  MEDICAL,
  CHART_COLORS,
  CYCLE_PHASE_COLORS,
  AI_MODELS,
  TEE_PLATFORMS,
  PROVIDER_NAMES,
  SPECIALTIES,
  RECORD_TYPES,
  STATUS_STYLES,
  DATA_SCOPES,
  NAV_LINKS,
  CONSENT_SCOPES,
  CHAT_SUGGESTED_PROMPTS,
  WEARABLE_PROVIDERS,
  FHIR_RESOURCE_TYPES,
  ALERT_CHANNELS,
  ALERT_METRICS,
  GOVERNANCE_PROPOSAL_TYPES,
  MARKETPLACE_CATEGORIES,
  COMMUNITY_CATEGORIES,
  REWARD_ACTIONS,
  EXTENDED_STATUS_STYLES,
  PRIMARY_NAV_LINKS,
  SECONDARY_NAV_LINKS,
  TERTIARY_NAV_LINKS,
  VAULT_CATEGORIES,
  SYMPTOM_CATEGORIES,
  REPRODUCTIVE_JURISDICTIONS,
  CLINICAL_PATHWAY_TYPES,
  DRUG_SEVERITY_LEVELS,
  TRIAGE_LEVELS,
  GENOMIC_RISK_CATEGORIES,
  BIOMARKER_TYPES,
  ORGAN_SYSTEMS,
  COMPLIANCE_FRAMEWORKS,
  MPC_PROTOCOL_TYPES,
  EMERGENCY_PROTOCOL_CATEGORIES,
  TEE_ENCLAVE_TYPES,
  COMPUTE_JOB_STATES,
} from '@/lib/constants';

// ---------------------------------------------------------------------------
// BRAND colors
// ---------------------------------------------------------------------------
describe('BRAND', () => {
  it('has all required color keys', () => {
    expect(BRAND.sky).toBeDefined();
    expect(BRAND.skyDark).toBeDefined();
    expect(BRAND.skyLight).toBeDefined();
    expect(BRAND.skyGlow).toBeDefined();
  });

  it('contains valid hex or rgba color values', () => {
    expect(BRAND.sky).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(BRAND.skyDark).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(BRAND.skyLight).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(BRAND.skyGlow).toMatch(/^rgba\(/);
  });
});

// ---------------------------------------------------------------------------
// MEDICAL colors
// ---------------------------------------------------------------------------
describe('MEDICAL', () => {
  it('has all required color keys', () => {
    expect(MEDICAL.mint).toBeDefined();
    expect(MEDICAL.coral).toBeDefined();
    expect(MEDICAL.lavender).toBeDefined();
    expect(MEDICAL.peach).toBeDefined();
    expect(MEDICAL.sage).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// CHART_COLORS
// ---------------------------------------------------------------------------
describe('CHART_COLORS', () => {
  it('is a non-empty array', () => {
    expect(CHART_COLORS.length).toBeGreaterThan(0);
  });

  it('contains valid hex color strings', () => {
    CHART_COLORS.forEach((color) => {
      expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
    });
  });
});

// ---------------------------------------------------------------------------
// CYCLE_PHASE_COLORS
// ---------------------------------------------------------------------------
describe('CYCLE_PHASE_COLORS', () => {
  it('has all four cycle phases', () => {
    expect(CYCLE_PHASE_COLORS.menstrual).toBeDefined();
    expect(CYCLE_PHASE_COLORS.follicular).toBeDefined();
    expect(CYCLE_PHASE_COLORS.ovulation).toBeDefined();
    expect(CYCLE_PHASE_COLORS.luteal).toBeDefined();
  });

  it('each phase has fill, stroke, and label', () => {
    Object.values(CYCLE_PHASE_COLORS).forEach((phase) => {
      expect(phase.fill).toBeDefined();
      expect(phase.stroke).toBeDefined();
      expect(phase.label).toBeDefined();
      expect(typeof phase.label).toBe('string');
    });
  });
});

// ---------------------------------------------------------------------------
// AI_MODELS
// ---------------------------------------------------------------------------
describe('AI_MODELS', () => {
  it('is a non-empty array', () => {
    expect(AI_MODELS.length).toBeGreaterThan(0);
  });

  it('each model has required fields', () => {
    AI_MODELS.forEach((model) => {
      expect(model.id).toBeDefined();
      expect(typeof model.id).toBe('string');
      expect(model.name).toBeDefined();
      expect(typeof model.name).toBe('string');
      expect(model.version).toBeDefined();
      expect(typeof model.version).toBe('string');
      expect(model.type).toBeDefined();
      expect(typeof model.type).toBe('string');
      expect(model.accuracy).toBeDefined();
      expect(typeof model.accuracy).toBe('number');
      expect(model.accuracy).toBeGreaterThan(0);
      expect(model.accuracy).toBeLessThanOrEqual(100);
      expect(model.description).toBeDefined();
      expect(typeof model.description).toBe('string');
    });
  });

  it('has unique model IDs', () => {
    const ids = AI_MODELS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ---------------------------------------------------------------------------
// TEE_PLATFORMS
// ---------------------------------------------------------------------------
describe('TEE_PLATFORMS', () => {
  it('is a non-empty array', () => {
    expect(TEE_PLATFORMS.length).toBeGreaterThan(0);
  });

  it('contains known TEE platforms', () => {
    expect(TEE_PLATFORMS).toContain('Intel SGX');
    expect(TEE_PLATFORMS).toContain('AWS Nitro');
  });
});

// ---------------------------------------------------------------------------
// PROVIDER_NAMES
// ---------------------------------------------------------------------------
describe('PROVIDER_NAMES', () => {
  it('is a non-empty array of strings', () => {
    expect(PROVIDER_NAMES.length).toBeGreaterThan(0);
    PROVIDER_NAMES.forEach((name) => {
      expect(typeof name).toBe('string');
      expect(name.length).toBeGreaterThan(0);
    });
  });
});

// ---------------------------------------------------------------------------
// SPECIALTIES
// ---------------------------------------------------------------------------
describe('SPECIALTIES', () => {
  it('is a non-empty array of strings', () => {
    expect(SPECIALTIES.length).toBeGreaterThan(0);
    SPECIALTIES.forEach((s) => {
      expect(typeof s).toBe('string');
    });
  });
});

// ---------------------------------------------------------------------------
// RECORD_TYPES
// ---------------------------------------------------------------------------
describe('RECORD_TYPES', () => {
  it('is a non-empty array', () => {
    expect(RECORD_TYPES.length).toBeGreaterThan(0);
  });

  it('each record type has id, label, and icon', () => {
    RECORD_TYPES.forEach((rt) => {
      expect(rt.id).toBeDefined();
      expect(typeof rt.id).toBe('string');
      expect(rt.label).toBeDefined();
      expect(typeof rt.label).toBe('string');
      expect(rt.icon).toBeDefined();
      expect(typeof rt.icon).toBe('string');
    });
  });

  it('has unique IDs', () => {
    const ids = RECORD_TYPES.map((rt) => rt.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ---------------------------------------------------------------------------
// STATUS_STYLES
// ---------------------------------------------------------------------------
describe('STATUS_STYLES', () => {
  const requiredStatuses = [
    'Verified',
    'Active',
    'Encrypted',
    'Processing',
    'Pending',
    'Pinning',
    'Pinned',
    'Revoked',
    'Expired',
    'Anomaly',
    'Normal',
    'High',
    'Medium',
    'Low',
    'Operational',
    'Degraded',
    'Offline',
  ];

  it('has all required status keys', () => {
    requiredStatuses.forEach((status) => {
      expect(STATUS_STYLES[status]).toBeDefined();
    });
  });

  it('each status has bg, text, border, and dot', () => {
    Object.entries(STATUS_STYLES).forEach(([key, style]) => {
      expect(style.bg).toBeDefined();
      expect(style.text).toBeDefined();
      expect(style.border).toBeDefined();
      expect(style.dot).toBeDefined();
      expect(typeof style.bg).toBe('string');
      expect(typeof style.text).toBe('string');
      expect(typeof style.border).toBe('string');
      expect(typeof style.dot).toBe('string');
    });
  });
});

// ---------------------------------------------------------------------------
// DATA_SCOPES
// ---------------------------------------------------------------------------
describe('DATA_SCOPES', () => {
  it('is a non-empty array', () => {
    expect(DATA_SCOPES.length).toBeGreaterThan(0);
  });

  it('contains "Full Records"', () => {
    expect(DATA_SCOPES).toContain('Full Records');
  });
});

// ---------------------------------------------------------------------------
// NAV_LINKS
// ---------------------------------------------------------------------------
describe('NAV_LINKS', () => {
  it('is a non-empty array', () => {
    expect(NAV_LINKS.length).toBeGreaterThan(0);
  });

  it('each link has href and label', () => {
    NAV_LINKS.forEach((link) => {
      expect(link.href).toBeDefined();
      expect(typeof link.href).toBe('string');
      expect(link.href.startsWith('/')).toBe(true);
      expect(link.label).toBeDefined();
      expect(typeof link.label).toBe('string');
    });
  });

  it('includes Dashboard link at /', () => {
    const dashboardLink = NAV_LINKS.find((l) => l.href === '/');
    expect(dashboardLink).toBeDefined();
    expect(dashboardLink?.label).toBe('Dashboard');
  });

  it('has unique hrefs', () => {
    const hrefs = NAV_LINKS.map((l) => l.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});

// ---------------------------------------------------------------------------
// Additional constants coverage
// ---------------------------------------------------------------------------
describe('CONSENT_SCOPES', () => {
  it('is a non-empty array with id and label', () => {
    expect(CONSENT_SCOPES.length).toBeGreaterThan(0);
    CONSENT_SCOPES.forEach((s) => {
      expect(s.id).toBeDefined();
      expect(s.label).toBeDefined();
    });
  });
});

describe('CHAT_SUGGESTED_PROMPTS', () => {
  it('is a non-empty array', () => {
    expect(CHAT_SUGGESTED_PROMPTS.length).toBeGreaterThan(0);
    CHAT_SUGGESTED_PROMPTS.forEach((p) => {
      expect(p.id).toBeDefined();
      expect(p.prompt).toBeDefined();
    });
  });
});

describe('WEARABLE_PROVIDERS', () => {
  it('is a non-empty array with metrics', () => {
    expect(WEARABLE_PROVIDERS.length).toBeGreaterThan(0);
    WEARABLE_PROVIDERS.forEach((w) => {
      expect(w.metrics.length).toBeGreaterThan(0);
    });
  });
});

describe('FHIR_RESOURCE_TYPES', () => {
  it('is a non-empty array', () => {
    expect(FHIR_RESOURCE_TYPES.length).toBeGreaterThan(0);
  });
});

describe('ALERT_CHANNELS', () => {
  it('is a non-empty array', () => {
    expect(ALERT_CHANNELS.length).toBeGreaterThan(0);
  });
});

describe('ALERT_METRICS', () => {
  it('is a non-empty array', () => {
    expect(ALERT_METRICS.length).toBeGreaterThan(0);
  });
});

describe('GOVERNANCE_PROPOSAL_TYPES', () => {
  it('is a non-empty array', () => {
    expect(GOVERNANCE_PROPOSAL_TYPES.length).toBeGreaterThan(0);
  });
});

describe('MARKETPLACE_CATEGORIES', () => {
  it('is a non-empty array', () => {
    expect(MARKETPLACE_CATEGORIES.length).toBeGreaterThan(0);
  });
});

describe('COMMUNITY_CATEGORIES', () => {
  it('is a non-empty array', () => {
    expect(COMMUNITY_CATEGORIES.length).toBeGreaterThan(0);
  });
});

describe('REWARD_ACTIONS', () => {
  it('is a non-empty array with aethel amounts', () => {
    expect(REWARD_ACTIONS.length).toBeGreaterThan(0);
    REWARD_ACTIONS.forEach((r) => {
      expect(r.aethel).toBeGreaterThan(0);
    });
  });
});

describe('EXTENDED_STATUS_STYLES', () => {
  it('has expected status keys', () => {
    expect(EXTENDED_STATUS_STYLES.active).toBeDefined();
    expect(EXTENDED_STATUS_STYLES.expired).toBeDefined();
    expect(EXTENDED_STATUS_STYLES.revoked).toBeDefined();
  });
});

describe('PRIMARY_NAV_LINKS', () => {
  it('is a non-empty array', () => {
    expect(PRIMARY_NAV_LINKS.length).toBeGreaterThan(0);
  });
});

describe('SECONDARY_NAV_LINKS', () => {
  it('is a non-empty array', () => {
    expect(SECONDARY_NAV_LINKS.length).toBeGreaterThan(0);
  });
});

describe('TERTIARY_NAV_LINKS', () => {
  it('is a non-empty array', () => {
    expect(TERTIARY_NAV_LINKS.length).toBeGreaterThan(0);
  });
});

describe('VAULT_CATEGORIES', () => {
  it('is a non-empty array', () => {
    expect(VAULT_CATEGORIES.length).toBeGreaterThan(0);
  });
});

describe('SYMPTOM_CATEGORIES', () => {
  it('is a non-empty array', () => {
    expect(SYMPTOM_CATEGORIES.length).toBeGreaterThan(0);
  });
});

describe('REPRODUCTIVE_JURISDICTIONS', () => {
  it('is a non-empty array', () => {
    expect(REPRODUCTIVE_JURISDICTIONS.length).toBeGreaterThan(0);
  });
});

describe('CLINICAL_PATHWAY_TYPES', () => {
  it('is a non-empty array', () => {
    expect(CLINICAL_PATHWAY_TYPES.length).toBeGreaterThan(0);
  });
});

describe('DRUG_SEVERITY_LEVELS', () => {
  it('is a non-empty array', () => {
    expect(DRUG_SEVERITY_LEVELS.length).toBeGreaterThan(0);
  });
});

describe('TRIAGE_LEVELS', () => {
  it('is a non-empty array', () => {
    expect(TRIAGE_LEVELS.length).toBeGreaterThan(0);
  });
});

describe('GENOMIC_RISK_CATEGORIES', () => {
  it('is a non-empty array', () => {
    expect(GENOMIC_RISK_CATEGORIES.length).toBeGreaterThan(0);
  });
});

describe('BIOMARKER_TYPES', () => {
  it('is a non-empty array with reference ranges', () => {
    expect(BIOMARKER_TYPES.length).toBeGreaterThan(0);
    BIOMARKER_TYPES.forEach((b) => {
      expect(b.refRange).toBeDefined();
    });
  });
});

describe('ORGAN_SYSTEMS', () => {
  it('is a non-empty array', () => {
    expect(ORGAN_SYSTEMS.length).toBeGreaterThan(0);
  });
});

describe('COMPLIANCE_FRAMEWORKS', () => {
  it('is a non-empty array', () => {
    expect(COMPLIANCE_FRAMEWORKS.length).toBeGreaterThan(0);
  });
});

describe('MPC_PROTOCOL_TYPES', () => {
  it('is a non-empty array', () => {
    expect(MPC_PROTOCOL_TYPES.length).toBeGreaterThan(0);
  });
});

describe('EMERGENCY_PROTOCOL_CATEGORIES', () => {
  it('is a non-empty array', () => {
    expect(EMERGENCY_PROTOCOL_CATEGORIES.length).toBeGreaterThan(0);
  });
});

describe('TEE_ENCLAVE_TYPES', () => {
  it('is a non-empty array', () => {
    expect(TEE_ENCLAVE_TYPES.length).toBeGreaterThan(0);
  });
});

describe('COMPUTE_JOB_STATES', () => {
  it('is a non-empty array', () => {
    expect(COMPUTE_JOB_STATES.length).toBeGreaterThan(0);
  });
});
