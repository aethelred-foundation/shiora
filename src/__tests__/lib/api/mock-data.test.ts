/** @jest-environment node */

const actualUtilsMockData = jest.requireActual('@/lib/utils');
const mockSeededPickMockData = jest.fn(actualUtilsMockData.seededPick);
jest.mock('@/lib/utils', () => ({
  ...jest.requireActual('@/lib/utils'),
  seededPick: (...args: unknown[]) => mockSeededPickMockData(...args),
}));

import {
  generateMockRecords,
  findRecordById,
  generateMockGrants,
  findGrantById,
  generateMockAuditLog,
  generateMockAnomalies,
  generateMockInferences,
  generateMockAttestations,
  generateInsightsOverview,
  generateNetworkStatus,
  generateTEEStatus,
} from '@/lib/api/mock-data';

afterEach(() => {
  mockSeededPickMockData.mockImplementation(actualUtilsMockData.seededPick);
});

describe('generateMockRecords', () => {
  it('returns an array of records', () => {
    const records = generateMockRecords();
    expect(records.length).toBe(24);
  });

  it('returns cached results on repeat call with same count', () => {
    const first = generateMockRecords();
    const second = generateMockRecords();
    expect(first).toBe(second);
  });

  it('returns new results when count differs', () => {
    const records = generateMockRecords(5);
    expect(records.length).toBe(5);
  });

  it('each record has expected fields', () => {
    const records = generateMockRecords(3);
    records.forEach((r) => {
      expect(r.id).toBeDefined();
      expect(r.type).toBeDefined();
      expect(r.label).toBeDefined();
      expect(r.cid).toBeDefined();
      expect(r.txHash).toBeDefined();
      expect(r.ownerAddress).toBeDefined();
    });
  });

  it('falls back to ["Record"] when TYPE_DESCRIPTIONS has no entry for the type', () => {
    // Force seededPick to return an unknown type when picking from the 5-element types array
    const typesArray = ['lab_result', 'imaging', 'prescription', 'vitals', 'notes'];
    mockSeededPickMockData.mockImplementation((seed: number, arr: unknown[]) => {
      if (arr.length === 5 && JSON.stringify(arr) === JSON.stringify(typesArray)) {
        return 'unknown_type';
      }
      return actualUtilsMockData.seededPick(seed, arr);
    });
    // Use isolateModules to get a fresh module with no cached records
    let isolatedGenerateMockRecords: typeof generateMockRecords;
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require('@/lib/api/mock-data');
      isolatedGenerateMockRecords = mod.generateMockRecords;
    });
    const records = isolatedGenerateMockRecords!(2);
    expect(records.length).toBe(2);
    // All records should have type 'unknown_type' and label 'Record' (the fallback)
    records.forEach((r) => {
      expect(r.type).toBe('unknown_type');
      expect(r.label).toBe('Record');
    });
  });
});

describe('findRecordById', () => {
  it('finds an existing record by id', () => {
    const records = generateMockRecords();
    const record = findRecordById(records[5].id);
    expect(record).toBeDefined();
    expect(record!.id).toBe(records[5].id);
  });

  it('returns undefined for nonexistent id', () => {
    expect(findRecordById('nonexistent-id')).toBeUndefined();
  });
});

describe('generateMockGrants', () => {
  it('returns an array of grants', () => {
    const grants = generateMockGrants();
    expect(grants.length).toBe(8);
  });

  it('returns cached results on repeat call', () => {
    const first = generateMockGrants();
    const second = generateMockGrants();
    expect(first).toBe(second);
  });

  it('returns new results when count differs', () => {
    const grants = generateMockGrants(3);
    expect(grants.length).toBe(3);
  });
});

describe('findGrantById', () => {
  it('finds an existing grant by id', () => {
    const grants = generateMockGrants();
    const grant = findGrantById(grants[0].id);
    expect(grant).toBeDefined();
    expect(grant!.id).toBe(grants[0].id);
  });

  it('returns undefined for nonexistent id', () => {
    expect(findGrantById('nonexistent-id')).toBeUndefined();
  });
});

describe('generateMockAuditLog', () => {
  it('returns an array of audit entries', () => {
    const log = generateMockAuditLog();
    expect(log.length).toBe(20);
  });

  it('returns cached results on repeat call', () => {
    const first = generateMockAuditLog();
    const second = generateMockAuditLog();
    expect(first).toBe(second);
  });

  it('returns new results when count differs', () => {
    const log = generateMockAuditLog(5);
    expect(log.length).toBe(5);
  });

  it('each entry has expected fields', () => {
    const log = generateMockAuditLog(3);
    log.forEach((e) => {
      expect(e.id).toBeDefined();
      expect(e.action).toBeDefined();
      expect(e.type).toBeDefined();
      expect(e.txHash).toBeDefined();
    });
  });
});

describe('generateMockAnomalies', () => {
  it('returns an array of anomalies', () => {
    const anomalies = generateMockAnomalies();
    expect(anomalies.length).toBe(8);
  });

  it('returns cached results on repeat call', () => {
    const first = generateMockAnomalies();
    const second = generateMockAnomalies();
    expect(first).toBe(second);
  });

  it('returns new results when count differs', () => {
    const anomalies = generateMockAnomalies(3);
    expect(anomalies.length).toBe(3);
  });
});

describe('generateMockInferences', () => {
  it('returns an array of inferences', () => {
    const inferences = generateMockInferences();
    expect(inferences.length).toBe(20);
  });

  it('returns cached results on repeat call', () => {
    const first = generateMockInferences();
    const second = generateMockInferences();
    expect(first).toBe(second);
  });

  it('returns new results when count differs', () => {
    const inferences = generateMockInferences(5);
    expect(inferences.length).toBe(5);
  });
});

describe('generateMockAttestations', () => {
  it('returns an array of attestations', () => {
    const attestations = generateMockAttestations();
    expect(attestations.length).toBe(20);
  });

  it('returns cached results on repeat call', () => {
    const first = generateMockAttestations();
    const second = generateMockAttestations();
    expect(first).toBe(second);
  });

  it('returns new results when count differs', () => {
    const attestations = generateMockAttestations(5);
    expect(attestations.length).toBe(5);
  });

  it('even-indexed attestations have model data', () => {
    const attestations = generateMockAttestations(4);
    expect(attestations[0].modelId).not.toBeNull();
    expect(attestations[0].modelName).not.toBeNull();
    expect(attestations[1].modelId).toBeNull();
    expect(attestations[1].modelName).toBeNull();
  });
});

describe('generateInsightsOverview', () => {
  it('returns insights overview object', () => {
    const overview = generateInsightsOverview();
    expect(overview.cyclePrediction).toBeDefined();
    expect(overview.healthScores).toBeDefined();
    expect(overview.anomaliesSummary).toBeDefined();
    expect(overview.weeklyWellness).toBeDefined();
    expect(typeof overview.modelsActive).toBe('number');
    expect(typeof overview.totalInferences).toBe('number');
  });
});

describe('generateNetworkStatus', () => {
  it('returns network status object', () => {
    const status = generateNetworkStatus();
    expect(typeof status.blockHeight).toBe('number');
    expect(typeof status.tps).toBe('number');
    expect(typeof status.epoch).toBe('number');
    expect(typeof status.validators).toBe('number');
    expect(typeof status.aethelPrice).toBe('number');
  });
});

describe('generateTEEStatus', () => {
  it('returns TEE status object', () => {
    const status = generateTEEStatus();
    expect(status.status).toBe('operational');
    expect(status.platform).toBe('Intel SGX');
    expect(typeof status.attestationsToday).toBe('number');
    expect(typeof status.modelsLoaded).toBe('number');
  });
});
