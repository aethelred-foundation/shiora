// ============================================================
// MSW Request Handlers — Mock API endpoints for Shiora on Aethelred
// Handlers use wildcard prefix (*/api/...) so they intercept
// requests from both JSDOM (http://localhost) and browser contexts.
// All responses follow the server convention: { success, data, meta? }
// ============================================================

import { http, HttpResponse } from 'msw';

// ---------------------------------------------------------------------------
// Response helpers — mirrors the server successResponse / paginatedResponse
// ---------------------------------------------------------------------------

function ok<T>(data: T, status = 200) {
  return HttpResponse.json({ success: true, data }, { status });
}

function paginated<T>(data: T[], meta: { page: number; limit: number; total: number }) {
  return HttpResponse.json({
    success: true,
    data,
    meta: { ...meta, totalPages: Math.ceil(meta.total / meta.limit) },
  });
}

function err(code: string, message: string, status = 400) {
  return HttpResponse.json(
    { success: false, error: { code, message } },
    { status },
  );
}

// ---------------------------------------------------------------------------
// Mock Data
// ---------------------------------------------------------------------------

const mockRecords = Array.from({ length: 10 }, (_, i) => ({
  id: `rec-${String(i).padStart(4, '0')}`,
  type: ['lab_result', 'imaging', 'prescription', 'vitals', 'notes'][i % 5],
  label: [
    'Complete Blood Count', 'Pelvic Ultrasound', 'Estradiol Prescription',
    'Vitals Check', 'Progress Notes', 'Thyroid Panel', 'Mammogram',
    'Progesterone Rx', 'Blood Pressure', 'Visit Summary',
  ][i],
  date: Date.now() - i * 86400000,
  encrypted: true,
  encryption: 'AES-256-GCM',
  cid: `Qm${'a'.repeat(44)}`,
  txHash: `0x${'b'.repeat(64)}`,
  status: i < 2 ? 'Processing' : 'Verified',
  size: (50 + i * 20) * 1024,
  provider: `Dr. Provider ${i}`,
}));

const mockGrants = Array.from({ length: 5 }, (_, i) => ({
  id: `grant-${String(i).padStart(4, '0')}`,
  provider: `Dr. Provider ${i}`,
  providerName: `Dr. Provider ${i}`,
  specialty: ['OB-GYN', 'Endocrinology', 'Reproductive Medicine', 'Primary Care', 'Gynecology'][i],
  address: `aeth1${'x'.repeat(38)}`,
  providerAddress: `aeth1${'x'.repeat(38)}`,
  status: ['Active', 'Active', 'Expired', 'Revoked', 'Pending'][i],
  scope: 'Full Records',
  grantedAt: Date.now() - i * 86400000 * 30,
  expiresAt: Date.now() + (90 - i * 30) * 86400000,
  accessCount: 10 + i * 5,
  txHash: `0x${'c'.repeat(64)}`,
}));

const mockAuditLog = Array.from({ length: 8 }, (_, i) => ({
  id: `audit-${i}`,
  provider: `Dr. Provider ${i % 5}`,
  action: ['Viewed records', 'Downloaded report', 'Access granted', 'Access revoked'][i % 4],
  timestamp: Date.now() - i * 3600000,
  details: `Audit entry ${i}`,
  txHash: `0x${'c'.repeat(64)}`,
  type: ['access', 'download', 'grant', 'revoke'][i % 4],
}));

const mockInsights = {
  cyclePrediction: { nextPeriod: 12, fertileWindowStart: 8, fertileWindowEnd: 13, confidence: 96.2 },
  anomalies: Array.from({ length: 3 }, (_, i) => ({
    id: `anomaly-${i}`,
    type: ['Elevated Temperature', 'Irregular Cycle', 'Unusual Pattern'][i],
    severity: ['High', 'Medium', 'Low'][i],
    confidence: 90 + i * 2,
    detectedAt: Date.now() - i * 7200000,
    resolved: i > 1,
  })),
  healthScore: 82,
};

// ---------------------------------------------------------------------------
// Handlers — every path uses */ wildcard to match any origin
// ---------------------------------------------------------------------------

export const handlers = [
  // ── Wallet ────────────────────────────────────────────────────────────────

  http.get('*/api/wallet/challenge', ({ request }) => {
    const url = new URL(request.url);
    const address = url.searchParams.get('address') || '0x0000000000000000000000000000000000000000';
    return ok({
      message: `Shiora on Aethelred — Wallet Authentication\n\nAddress: ${address}\nNonce: mock-nonce-123\n\nSign this message to authenticate.`,
      nonce: 'mock-nonce-123',
      issuedAt: Date.now(),
      expiresAt: Date.now() + 300000,
      hmac: 'mock-hmac-value',
    });
  }),

  http.post('*/api/wallet/connect', async () => {
    return ok({
      address: 'aeth1mockaddress',
      expiresAt: Date.now() + 86400000,
      expiresIn: '24h',
      session: { transport: 'httpOnly-cookie', cookieName: 'shiora_session' },
      balances: { aethel: 48250.42 },
      profile: { recordCount: 147, activeGrants: 3, lastActivity: Date.now() - 3600000, memberSince: Date.now() - 180 * 86400000 },
    });
  }),

  http.delete('*/api/wallet/connect', () => ok({ disconnected: true })),

  // ── Records ───────────────────────────────────────────────────────────────

  http.get('*/api/records', ({ request }) => {
    const url = new URL(request.url);
    const type = url.searchParams.get('type');
    const search = url.searchParams.get('search');
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '20');

    let filtered = [...mockRecords];
    if (type && type !== 'all') filtered = filtered.filter((r) => r.type === type);
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter((r) => r.label.toLowerCase().includes(q) || r.provider.toLowerCase().includes(q));
    }
    const start = (page - 1) * limit;
    return paginated(filtered.slice(start, start + limit), { page, limit, total: filtered.length });
  }),

  http.get('*/api/records/:id', ({ params }) => {
    const record = mockRecords.find((r) => r.id === params.id);
    if (!record) return err('NOT_FOUND', 'Record not found', 404);
    return ok(record);
  }),

  http.post('*/api/records', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return ok({ id: `rec-${Date.now()}`, ...body, date: Date.now(), encrypted: true, encryption: 'AES-256-GCM', cid: `Qm${'d'.repeat(44)}`, txHash: `0x${'e'.repeat(64)}`, status: 'Processing' }, 201);
  }),

  http.patch('*/api/records/:id', async ({ params, request }) => {
    const record = mockRecords.find((r) => r.id === params.id);
    if (!record) return err('NOT_FOUND', 'Record not found', 404);
    const body = (await request.json()) as Record<string, unknown>;
    return ok({ ...record, ...body });
  }),

  http.delete('*/api/records/:id', ({ params }) => {
    const record = mockRecords.find((r) => r.id === params.id);
    if (!record) return err('NOT_FOUND', 'Record not found', 404);
    return ok({ deleted: true });
  }),

  // ── Access Grants ─────────────────────────────────────────────────────────

  http.get('*/api/access', ({ request }) => {
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    let filtered = [...mockGrants];
    if (status && status !== 'all') filtered = filtered.filter((g) => g.status === status);
    return paginated(filtered, { page: 1, limit: 20, total: filtered.length });
  }),

  http.get('*/api/access/:id', ({ params }) => {
    const grant = mockGrants.find((g) => g.id === params.id);
    if (!grant) return err('NOT_FOUND', 'Grant not found', 404);
    return ok(grant);
  }),

  http.post('*/api/access', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return ok({ id: `grant-${Date.now()}`, ...body, status: 'Pending', grantedAt: Date.now(), accessCount: 0, txHash: `0x${'d'.repeat(64)}` }, 201);
  }),

  http.patch('*/api/access/:id', async ({ params, request }) => {
    const grant = mockGrants.find((g) => g.id === params.id);
    if (!grant) return err('NOT_FOUND', 'Grant not found', 404);
    const body = (await request.json()) as Record<string, unknown>;
    return ok({ ...grant, ...body });
  }),

  http.delete('*/api/access/:id', ({ params }) => {
    if (!mockGrants.find((g) => g.id === params.id)) return err('NOT_FOUND', 'Grant not found', 404);
    return ok({ revoked: true });
  }),

  // ── Audit Log ─────────────────────────────────────────────────────────────

  http.get('*/api/access/audit', () => ok({ entries: mockAuditLog, total: mockAuditLog.length })),

  // ── Insights ──────────────────────────────────────────────────────────────

  http.get('*/api/insights', () => ok(mockInsights)),
  http.get('*/api/insights/anomalies', () => ok({ anomalies: mockInsights.anomalies, total: mockInsights.anomalies.length })),
  http.get('*/api/insights/inferences', () => ok({ inferences: [], total: 0 })),

  // ── TEE Status ────────────────────────────────────────────────────────────

  http.get('*/api/tee/status', () => ok({ status: 'operational', platform: 'Intel SGX', attestationsToday: 342, enclaveUptime: 99.97, inferencesCompleted: 12847 })),
  http.get('*/api/tee/attestations', () => ok({ attestations: [], total: 0 })),

  // ── Health ────────────────────────────────────────────────────────────────

  http.get('*/api/health', () => ok({ status: 'healthy', uptime: 99.99 })),
  http.get('*/api/network/status', () => ok({ blockHeight: 2847391, tps: 2150, epoch: 247, networkLoad: 72, aethelPrice: 1.24 })),

  // ── Chat ──────────────────────────────────────────────────────────────────

  http.get('*/api/chat', () => {
    const conversations = Array.from({ length: 6 }, (_, i) => ({
      id: `conv-${String(i).padStart(4, '0')}`,
      title: ['Cycle Analysis', 'Lab Results Review', 'Fertility Planning', 'Medication Questions', 'Sleep Analysis', 'Wellness Check'][i],
      createdAt: Date.now() - (6 - i) * 86400000 * 2,
      updatedAt: Date.now() - i * 3600000 * 3,
      messageCount: 8 + i * 2,
      lastMessage: 'Based on your recent data, I can provide some insights...',
      model: 'Health Transformer',
      totalTokens: 3000 + i * 500,
      attestationCount: 4 + i,
    }));
    return ok(conversations);
  }),

  http.post('*/api/chat', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return ok({ id: `msg-${Date.now()}`, conversationId: body.conversationId || 'conv-0001', role: 'assistant', content: 'Based on your health data processed in the TEE enclave, your cycle patterns appear consistent with healthy variation.', timestamp: Date.now(), attestation: `0x${'a'.repeat(64)}`, model: 'Health Transformer', confidence: 94, teePlatform: 'Intel SGX', tokens: 280 }, 201);
  }),

  http.get('*/api/chat/conversations', () => ok(Array.from({ length: 8 }, (_, i) => ({
    id: `conv-${String(i).padStart(4, '0')}`,
    title: ['Cycle Analysis Discussion', 'Lab Results Review', 'Fertility Planning', 'Medication Questions', 'Sleep Pattern Analysis', 'Wellness Check-in', 'Hormone Level Discussion', 'Nutrition Guidance'][i],
    createdAt: Date.now() - (8 - i) * 86400000 * 2,
    updatedAt: Date.now() - i * 3600000 * 3,
    messageCount: 6 + i * 3,
    lastMessage: 'Based on your cycle data from the last 6 months...',
    model: 'Health Transformer',
    totalTokens: 2500 + i * 300,
    attestationCount: 3 + i,
  })))),

  http.get('*/api/chat/:id', ({ params }) => ok({
    id: params.id,
    messages: Array.from({ length: 4 }, (_, i) => ({
      id: `msg-${i}`,
      conversationId: params.id,
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: i % 2 === 0 ? 'Analyze my recent cycle data' : 'Your cycle data shows consistent 28-day patterns with normal BBT shifts.',
      timestamp: Date.now() - (4 - i) * 60000,
      attestation: i % 2 === 1 ? `0x${'b'.repeat(64)}` : undefined,
      model: i % 2 === 1 ? 'Cycle LSTM' : undefined,
      confidence: i % 2 === 1 ? 96 : undefined,
    })),
  })),

  // ── Vault ─────────────────────────────────────────────────────────────────

  http.get('*/api/vault', () => ok({
    compartments: 8, totalRecords: 342, storageUsed: 1.8 * 1024 * 1024 * 1024,
    privacyScore: { overall: 92, encryptionScore: 98, accessControlScore: 90, jurisdictionScore: 85, dataMinimizationScore: 88 },
  })),

  http.get('*/api/vault/compartments', () => {
    const categories = ['cycle_tracking', 'fertility_data', 'hormone_levels', 'medications', 'lab_results', 'imaging', 'symptoms', 'pregnancy'];
    return ok(categories.map((cat, i) => ({
      id: `vault-${String(i).padStart(4, '0')}`, category: cat,
      label: cat.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      description: `Encrypted ${cat.replace(/_/g, ' ')} compartment`,
      lockStatus: i < 3 ? 'locked' : 'unlocked', recordCount: 10 + i * 8,
      storageUsed: (50 + i * 20) * 1024 * 1024, lastAccessed: Date.now() - i * 86400000,
      encryptionKey: `0x${'f'.repeat(64)}`, accessListCount: i % 3,
      jurisdictionFlags: ['us-ca', 'eu-gdpr'], createdAt: Date.now() - (180 + i * 30) * 86400000,
    })));
  }),

  http.get('*/api/vault/compartments/:id', ({ params }) => ok({
    id: params.id, category: 'cycle_tracking', label: 'Cycle Tracking',
    description: 'Encrypted cycle tracking compartment', lockStatus: 'locked',
    recordCount: 45, storageUsed: 120 * 1024 * 1024, lastAccessed: Date.now() - 3600000,
    encryptionKey: `0x${'f'.repeat(64)}`, accessListCount: 2,
    jurisdictionFlags: ['us-ca', 'eu-gdpr'], createdAt: Date.now() - 180 * 86400000,
  })),

  http.post('*/api/vault/compartments', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return ok({ id: `vault-${Date.now()}`, ...body, lockStatus: 'locked', recordCount: 0, storageUsed: 0, createdAt: Date.now() }, 201);
  }),

  http.get('*/api/vault/cycle', () => ok(Array.from({ length: 28 }, (_, i) => ({
    id: `cycle-${i}`, date: Date.now() - (28 - i) * 86400000, day: i + 1,
    phase: i < 5 ? 'menstrual' : i < 13 ? 'follicular' : i < 16 ? 'ovulation' : 'luteal',
    temperature: parseFloat((97.0 + (i >= 14 ? 0.5 : 0) + Math.random() * 0.4).toFixed(1)),
    flow: i < 5 ? (['light', 'medium', 'heavy', 'medium', 'light'] as const)[i] : 'none',
    symptoms: [] as string[], fertilityScore: i >= 10 && i <= 16 ? 70 + (i - 10) * 5 : 20, notes: '',
  })))),

  http.get('*/api/vault/symptoms', () => ok(Array.from({ length: 5 }, (_, i) => ({
    id: `sym-${i}`, date: Date.now() - i * 86400000,
    category: ['pain', 'mood', 'energy', 'digestive', 'sleep'][i],
    symptom: ['Cramps', 'Fatigue', 'Low energy', 'Bloating', 'Insomnia'][i],
    severity: (i % 4 + 1), notes: '', tags: [] as string[],
  })))),

  http.post('*/api/vault/symptoms', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return ok({ id: `sym-${Date.now()}`, ...body, date: Date.now() }, 201);
  }),

  // ── Consent ───────────────────────────────────────────────────────────────

  http.get('*/api/consent', ({ request }) => {
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const scope = url.searchParams.get('scope');
    const q = url.searchParams.get('q');
    const audit = url.searchParams.get('audit');
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '50');

    // When audit=true, return ConsentAuditEntry[]
    if (audit === 'true') {
      const auditEntries = Array.from({ length: 10 }, (_, i) => ({
        id: `audit-${String(i).padStart(4, '0')}`,
        consentId: `consent-${String(i % 5).padStart(4, '0')}`,
        action: ['granted', 'revoked', 'modified', 'renewed', 'expired'][i % 5],
        actor: `aeth1${'a'.repeat(38)}`,
        timestamp: Date.now() - i * 86400000,
        txHash: `0x${'f'.repeat(64)}`,
        details: `Audit action ${i}`,
      }));
      return paginated(auditEntries, { page: 1, limit: 20, total: auditEntries.length });
    }

    // 15 consent grants with proper status distribution
    const allConsents = Array.from({ length: 15 }, (_, i) => ({
      id: `consent-${String(i).padStart(4, '0')}`,
      patientAddress: `aeth1${'p'.repeat(38)}`, providerAddress: `aeth1${'q'.repeat(38)}`,
      providerName: `Dr. Provider ${i}`,
      scopes: i % 3 === 0 ? ['cycle_data', 'lab_results'] : i % 3 === 1 ? ['cycle_data'] : ['lab_results'],
      status: ['active', 'active', 'active', 'active', 'active', 'expired', 'expired', 'expired', 'revoked', 'revoked', 'revoked', 'pending', 'pending', 'pending', 'pending'][i],
      grantedAt: Date.now() - i * 86400000 * 10,
      expiresAt: Date.now() + (180 - i * 12) * 86400000,
      txHash: `0x${'d'.repeat(64)}`, attestation: `0x${'e'.repeat(64)}`,
      policyId: `policy-${i % 5}`, autoRenew: i < 5,
    }));

    let filtered = [...allConsents];
    if (status) filtered = filtered.filter((c) => c.status === status);
    if (scope) filtered = filtered.filter((c) => c.scopes.includes(scope));
    if (q) {
      const query = q.toLowerCase();
      filtered = filtered.filter((c) => c.providerName.toLowerCase().includes(query));
    }
    const start = (page - 1) * limit;
    return paginated(filtered.slice(start, start + limit), { page, limit, total: filtered.length });
  }),

  http.get('*/api/consent/policies', () => ok([
    { id: 'policy-0', name: 'Standard Access', description: 'Standard data access policy', scopes: ['cycle_data', 'lab_results'], defaultDurationDays: 90 },
    { id: 'policy-1', name: 'Research Access', description: 'Access for approved research', scopes: ['anonymized_data'], defaultDurationDays: 365 },
    { id: 'policy-2', name: 'Emergency Access', description: 'Emergency healthcare data access', scopes: ['cycle_data', 'lab_results', 'vitals'], defaultDurationDays: 7 },
    { id: 'policy-3', name: 'Specialist Referral', description: 'Referral data sharing with specialist', scopes: ['lab_results'], defaultDurationDays: 30 },
    { id: 'policy-4', name: 'Full Access', description: 'Comprehensive data access for primary care', scopes: ['cycle_data', 'lab_results', 'vitals', 'medications'], defaultDurationDays: 180 },
  ])),

  http.get('*/api/consent/:id', ({ params }) => ok({
    id: params.id, patientAddress: `aeth1${'p'.repeat(38)}`, providerAddress: `aeth1${'q'.repeat(38)}`,
    providerName: 'Dr. Provider 0', scopes: ['cycle_data'], status: 'active',
    grantedAt: Date.now() - 30 * 86400000, expiresAt: Date.now() + 60 * 86400000,
    txHash: `0x${'d'.repeat(64)}`, attestation: `0x${'e'.repeat(64)}`,
    policyId: 'policy-0', autoRenew: true,
  })),

  http.post('*/api/consent', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return ok({ id: `consent-${Date.now()}`, ...body, status: 'pending', grantedAt: Date.now(), txHash: `0x${'f'.repeat(64)}`, attestation: `0x${'a'.repeat(64)}` }, 201);
  }),

  http.patch('*/api/consent/:id', async ({ params, request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return ok({ id: params.id, ...body });
  }),

  // ── Marketplace ───────────────────────────────────────────────────────────

  http.get('*/api/marketplace', ({ request }) => {
    const url = new URL(request.url);
    const category = url.searchParams.get('category');
    const listings = Array.from({ length: 8 }, (_, i) => ({
      id: `listing-${String(i).padStart(4, '0')}`,
      seller: `aeth1${'s'.repeat(38)}`, sellerReputation: 80 + i * 2,
      category: ['menstrual_cycles', 'fertility_data', 'lab_results', 'vitals_timeseries', 'wearable_data', 'imaging_anonymized', 'clinical_outcomes', 'medication_responses'][i],
      title: `Anonymized ${['Cycle', 'Fertility', 'Lab', 'Vitals', 'Wearable', 'Imaging', 'Outcomes', 'Medication'][i]} Dataset`,
      description: 'High-quality anonymized health dataset with TEE verification.',
      dataPoints: 500 + i * 200, qualityScore: 85 + i,
      anonymizationLevel: ['k-anonymity', 'l-diversity', 'differential-privacy'][i % 3],
      price: 15 + i * 10, currency: 'AETHEL',
      status: i < 6 ? 'active' : 'sold', teeVerified: true,
      attestation: `0x${'a'.repeat(64)}`, purchaseCount: i * 3,
      createdAt: Date.now() - i * 86400000 * 5, expiresAt: Date.now() + 90 * 86400000,
    }));
    const filtered = category ? listings.filter((l) => l.category === category) : listings;
    return ok(filtered);
  }),

  http.get('*/api/marketplace/stats', () => ok({
    totalListings: 847, activeListings: 312, totalVolume: 45200, totalSellers: 234, totalBuyers: 891, averagePrice: 32.5,
    topCategories: [
      { category: 'menstrual_cycles', count: 120, volume: 12400 },
      { category: 'lab_results', count: 85, volume: 8900 },
      { category: 'wearable_data', count: 72, volume: 6300 },
    ],
  })),

  http.get('*/api/marketplace/:id', ({ params }) => ok({
    id: params.id, seller: `aeth1${'s'.repeat(38)}`, sellerReputation: 92,
    category: 'menstrual_cycles', title: 'Anonymized Cycle Dataset',
    description: 'High-quality anonymized cycle tracking data.', dataPoints: 1200,
    qualityScore: 94, anonymizationLevel: 'differential-privacy',
    price: 45, currency: 'AETHEL', status: 'active', teeVerified: true,
    attestation: `0x${'a'.repeat(64)}`, purchaseCount: 12,
    createdAt: Date.now() - 30 * 86400000, expiresAt: Date.now() + 60 * 86400000,
  })),

  http.post('*/api/marketplace', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return ok({ id: `listing-${Date.now()}`, ...body, status: 'active', teeVerified: true, purchaseCount: 0, createdAt: Date.now() }, 201);
  }),

  // ── Wearables ─────────────────────────────────────────────────────────────

  http.get('*/api/wearables', ({ request }) => {
    const url = new URL(request.url);
    const view = url.searchParams.get('view');

    // When view=data-points, return WearableDataPoint[]
    if (view === 'data-points') {
      return ok(Array.from({ length: 24 }, (_, i) => ({
        id: `dp-${String(i).padStart(4, '0')}`,
        deviceId: 'dev-001',
        metric: url.searchParams.get('metric') || 'heart_rate',
        value: 60 + Math.round(Math.sin(i / 3) * 15),
        unit: 'bpm',
        timestamp: Date.now() - (24 - i) * 3600000,
        source: 'apple_health',
      })));
    }

    return ok([
      { id: 'dev-001', provider: 'apple_health', deviceName: 'Apple Health', status: 'connected', lastSync: Date.now() - 3600000, dataPointsSynced: 12400, batteryLevel: 82, firmwareVersion: 'v3.2.1', connectedAt: Date.now() - 90 * 86400000 },
      { id: 'dev-002', provider: 'oura', deviceName: 'Oura Ring', status: 'connected', lastSync: Date.now() - 7200000, dataPointsSynced: 8700, batteryLevel: 65, firmwareVersion: 'v2.8.0', connectedAt: Date.now() - 60 * 86400000 },
      { id: 'dev-003', provider: 'whoop', deviceName: 'WHOOP', status: 'connected', lastSync: Date.now() - 10800000, dataPointsSynced: 6200, batteryLevel: 45, firmwareVersion: 'v4.1.0', connectedAt: Date.now() - 45 * 86400000 },
      { id: 'dev-004', provider: 'fitbit', deviceName: 'Fitbit', status: 'disconnected', lastSync: Date.now() - 86400000 * 3, dataPointsSynced: 3200, batteryLevel: 12, firmwareVersion: 'v1.5.2', connectedAt: Date.now() - 30 * 86400000 },
      { id: 'dev-005', provider: 'garmin', deviceName: 'Garmin', status: 'disconnected', lastSync: Date.now() - 86400000 * 7, dataPointsSynced: 1500, batteryLevel: null, firmwareVersion: 'v2.0.3', connectedAt: null },
    ]);
  }),

  http.get('*/api/wearables/sync', () => ok(Array.from({ length: 5 }, (_, i) => ({
    id: `sync-${String(i).padStart(4, '0')}`,
    deviceId: `dev-${String((i % 3) + 1).padStart(3, '0')}`,
    syncedAt: Date.now() - i * 3600000 * 6,
    dataPointCount: 100 + i * 30,
    attestation: `0x${'b'.repeat(64)}`,
    status: i < 3 ? 'completed' : 'processing',
  })))),

  http.post('*/api/wearables/sync', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return ok({ id: `sync-${Date.now()}`, deviceId: body.deviceId || 'dev-001', syncedAt: Date.now(), dataPointCount: 142, attestation: `0x${'b'.repeat(64)}`, status: 'completed' }, 201);
  }),

  http.get('*/api/wearables/:provider', ({ params }) => ok({
    id: `dev-${params.provider}`, provider: params.provider, deviceName: `${String(params.provider).replace('_', ' ')} Device`,
    status: 'connected', lastSync: Date.now() - 3600000, dataPointsSynced: 5000, connectedAt: Date.now() - 60 * 86400000,
  })),

  // ── FHIR ──────────────────────────────────────────────────────────────────

  http.get('*/api/fhir', () => ok(Array.from({ length: 5 }, (_, i) => ({
    id: `fhir-${String(i).padStart(4, '0')}`,
    resourceType: ['Patient', 'Observation', 'MedicationRequest', 'Condition', 'DiagnosticReport'][i],
    status: 'active', lastUpdated: Date.now() - i * 86400000, rawJson: '{}',
    mappedRecordId: i < 3 ? `rec-${String(i).padStart(4, '0')}` : undefined,
  })))),

  http.get('*/api/fhir/mapping', () => ok([
    { id: 'map-001', fhirResourceType: 'Observation', shioraRecordType: 'vitals', fieldMappings: [{ fhirPath: 'Observation.value', shioraField: 'value' }], isDefault: true },
    { id: 'map-002', fhirResourceType: 'DiagnosticReport', shioraRecordType: 'lab_result', fieldMappings: [{ fhirPath: 'DiagnosticReport.result', shioraField: 'results' }], isDefault: true },
    { id: 'map-003', fhirResourceType: 'MedicationRequest', shioraRecordType: 'prescription', fieldMappings: [{ fhirPath: 'MedicationRequest.medication', shioraField: 'medication' }], isDefault: true },
  ])),

  http.get('*/api/fhir/import', () => ok([
    { id: 'import-001', source: 'Epic MyChart Export', resourceCount: 24, processedCount: 24, failedCount: 0, status: 'completed', startedAt: Date.now() - 86400000 * 2, completedAt: Date.now() - 86400000 * 2 + 300000, errors: [] },
    { id: 'import-002', source: 'Cerner Health Portal', resourceCount: 18, processedCount: 15, failedCount: 3, status: 'completed', startedAt: Date.now() - 86400000 * 5, completedAt: Date.now() - 86400000 * 5 + 600000, errors: ['Invalid Observation format', 'Missing required field', 'Duplicate resource'] },
    { id: 'import-003', source: 'FHIR Bundle Upload', resourceCount: 10, processedCount: 0, failedCount: 0, status: 'processing', startedAt: Date.now() - 3600000, errors: [] },
  ])),

  http.post('*/api/fhir/import', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return ok({ id: `import-${Date.now()}`, source: body.source || 'external', resourceCount: 25, processedCount: 0, failedCount: 0, status: 'processing', startedAt: Date.now(), errors: [] }, 201);
  }),

  http.get('*/api/fhir/export', () => ok([{
    id: 'export-001', format: 'json', resourceTypes: ['Observation', 'MedicationRequest'],
    destination: 'ipfs', lastExportAt: Date.now() - 86400000,
  }])),

  http.post('*/api/fhir/export', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return ok({ id: `export-${Date.now()}`, ...body, status: 'processing', startedAt: Date.now() }, 201);
  }),

  // ── Alerts ────────────────────────────────────────────────────────────────

  http.get('*/api/alerts', () => ok(Array.from({ length: 5 }, (_, i) => ({
    id: `alert-${String(i).padStart(4, '0')}`, ruleId: `rule-${i}`,
    metric: ['temperature', 'heart_rate', 'spo2', 'cycle_length', 'hrv'][i],
    severity: ['critical', 'warning', 'info', 'warning', 'info'][i],
    title: ['High Temperature', 'Elevated Heart Rate', 'Low SpO2', 'Irregular Cycle', 'Low HRV'][i],
    message: `Anomaly detected in health readings.`,
    currentValue: [101.2, 105, 93, 38, 18][i], threshold: [100.4, 100, 94, 35, 20][i],
    triggeredAt: Date.now() - i * 3600000 * 4,
    acknowledgedAt: i > 2 ? Date.now() - i * 3600000 : undefined,
    modelId: 'anomaly', confidence: 88 + i * 2, attestation: `0x${'c'.repeat(64)}`,
  })))),

  http.get('*/api/alerts/rules', () => ok([
    { id: 'rule-0', metric: 'temperature', operator: 'gt', threshold: 100.4, severity: 'critical', enabled: true, channels: ['push', 'email'] },
    { id: 'rule-1', metric: 'heart_rate', operator: 'gt', threshold: 100, severity: 'warning', enabled: true, channels: ['push'] },
  ])),

  http.get('*/api/alerts/history', () => ok(Array.from({ length: 10 }, (_, i) => ({
    id: `hist-${i}`, alertId: `alert-${i % 5}`, metric: ['temperature', 'heart_rate', 'spo2', 'cycle_length', 'hrv'][i % 5],
    severity: ['critical', 'warning', 'info'][i % 3], timestamp: Date.now() - i * 86400000,
    resolved: i > 5, resolvedAt: i > 5 ? Date.now() - (i - 2) * 86400000 : undefined,
  })))),

  http.post('*/api/alerts', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return ok({ id: `rule-${Date.now()}`, ...body, enabled: true, createdAt: Date.now() }, 201);
  }),

  http.post('*/api/alerts/rules', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return ok({ id: `rule-${Date.now()}`, ...body, enabled: true, createdAt: Date.now() }, 201);
  }),

  // ── ZKP ───────────────────────────────────────────────────────────────────

  http.get('*/api/zkp/claims', ({ request }) => {
    const url = new URL(request.url);
    const view = url.searchParams.get('view');

    // When view=proofs, return ZKProof[] instead of ZKClaim[]
    if (view === 'proofs') {
      return ok(Array.from({ length: 3 }, (_, i) => ({
        id: `proof-${i}`,
        claimType: ['age_range', 'condition_present', 'data_quality'][i],
        proofHash: `0x${'d'.repeat(64)}`,
        publicInputs: '{"verified": true}',
        verified: true,
        verifiedAt: Date.now() - i * 86400000,
        createdAt: Date.now() - (i + 1) * 86400000,
        expiresAt: Date.now() + 90 * 86400000,
        txHash: `0x${'e'.repeat(64)}`,
      })));
    }

    return ok(Array.from({ length: 4 }, (_, i) => ({
      id: `claim-${String(i).padStart(4, '0')}`,
      claimType: ['age_range', 'condition_present', 'data_quality', 'provider_verified'][i],
      description: ['Age is within 25-35 range', 'Has verified condition', 'Data quality score above 90', 'Provider is TEE-verified'][i],
      proof: i < 3 ? { id: `proof-${i}`, claimType: ['age_range', 'condition_present', 'data_quality'][i], proofHash: `0x${'d'.repeat(64)}`, publicInputs: '{"verified": true}', verified: true, verifiedAt: Date.now() - i * 86400000, createdAt: Date.now() - (i + 1) * 86400000, expiresAt: Date.now() + 90 * 86400000 } : undefined,
      status: i < 2 ? 'verified' : i === 2 ? 'proving' : 'unproven',
      createdAt: Date.now() - (i + 1) * 86400000,
    })));
  }),

  http.post('*/api/zkp/prove', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return ok({ id: `proof-${Date.now()}`, claimType: body.claimType || 'age_range', proofHash: `0x${'e'.repeat(64)}`, publicInputs: JSON.stringify({ verified: true }), verified: false, createdAt: Date.now(), expiresAt: Date.now() + 90 * 86400000, status: 'proving' }, 201);
  }),

  http.post('*/api/zkp/verify', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return ok({ valid: true, claimType: body.claimType || 'age_range', verifiedAt: Date.now(), blockHeight: 2847400, gasUsed: 145000 });
  }),

  // ── Governance ────────────────────────────────────────────────────────────

  http.get('*/api/governance/proposals', ({ request }) => {
    const url = new URL(request.url);
    const view = url.searchParams.get('view');
    const statusFilter = url.searchParams.get('status');

    // When view=stats, return GovernanceStats
    if (view === 'stats') {
      return ok({
        totalProposals: 12,
        activeProposals: 3,
        totalVoters: 1234,
        totalVotingPower: 2847000,
        quorumThreshold: 10,
        treasuryBalance: 1500000,
      });
    }

    // When view=delegations, return Delegation[]
    if (view === 'delegations') {
      return ok([
        { id: 'del-0001', delegator: `aeth1${'d'.repeat(38)}`, delegatee: `aeth1${'e'.repeat(38)}`, amount: 2000, delegatedAt: Date.now() - 30 * 86400000, txHash: `0x${'f'.repeat(64)}` },
      ]);
    }

    const proposals = Array.from({ length: 12 }, (_, i) => ({
      id: `prop-${String(i).padStart(4, '0')}`, proposer: `aeth1${'g'.repeat(38)}`,
      type: ['parameter', 'feature', 'treasury', 'parameter', 'feature', 'emergency', 'parameter', 'feature', 'treasury', 'parameter', 'feature', 'emergency'][i],
      title: [
        'Increase minimum staking amount to 500 AETHEL',
        'Add differential privacy to wearable data',
        'Fund community health research grant',
        'Lower TEE attestation frequency to 6h',
        'Add Garmin wearable integration',
        'Emergency: Patch consent revocation bug',
        'Increase data marketplace fee cap to 5%',
        'Implement cross-chain bridge for AETHEL',
        'Allocate treasury funds for audit',
        'Reduce validator minimum stake',
        'Add WebAuthn support for wallet',
        'Emergency: Fix governance quorum calculation',
      ][i],
      description: `Detailed proposal description for proposal ${i}.`,
      forVotes: 45000 + i * 5000, againstVotes: 12000 + i * 2000, abstainVotes: 3000 + i * 500, quorum: 100000,
      startBlock: 2847000 - i * 1000, endBlock: 2857000 - i * 1000,
      status: i < 3 ? 'active' : ['passed', 'executed', 'defeated', 'active', 'passed', 'executed', 'defeated', 'cancelled', 'active'][i - 3],
      createdAt: Date.now() - i * 86400000 * 7, txHash: `0x${'f'.repeat(64)}`,
    }));

    const filtered = statusFilter ? proposals.filter((p) => p.status === statusFilter) : proposals;
    return ok(filtered);
  }),

  http.get('*/api/governance/proposals/:id', ({ params }) => ok({
    id: params.id, proposer: `aeth1${'g'.repeat(38)}`, type: 'feature',
    title: 'Add differential privacy to wearable data',
    description: 'This proposal seeks to integrate differential privacy mechanisms into the wearable data pipeline.',
    forVotes: 52000, againstVotes: 14000, abstainVotes: 3500, quorum: 100000,
    startBlock: 2847000, endBlock: 2857000, status: 'active',
    createdAt: Date.now() - 7 * 86400000, txHash: `0x${'f'.repeat(64)}`,
  })),

  http.get('*/api/governance/vote', () => ok(Array.from({ length: 3 }, (_, i) => ({
    id: `vote-${String(i).padStart(4, '0')}`,
    proposalId: `prop-${String(i).padStart(4, '0')}`,
    voter: `aeth1${'v'.repeat(38)}`,
    support: ['for', 'against', 'abstain'][i],
    weight: 1200 + i * 200,
    timestamp: Date.now() - i * 86400000,
    txHash: `0x${'a'.repeat(64)}`,
  })))),

  http.post('*/api/governance/vote', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return ok({ id: `vote-${Date.now()}`, proposalId: body.proposalId, voter: `aeth1${'v'.repeat(38)}`, support: body.support || 'for', weight: 1200, timestamp: Date.now(), txHash: `0x${'a'.repeat(64)}` }, 201);
  }),

  http.post('*/api/governance/proposals', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return ok({ id: `prop-${Date.now()}`, ...body, status: 'active', forVotes: 0, againstVotes: 0, abstainVotes: 0, createdAt: Date.now(), txHash: `0x${'f'.repeat(64)}` }, 201);
  }),

  // ── Staking ───────────────────────────────────────────────────────────────

  http.get('*/api/staking', () => ok({
    positions: Array.from({ length: 3 }, (_, i) => ({
      id: `stake-${String(i).padStart(4, '0')}`, staker: `aeth1${'s'.repeat(38)}`,
      amount: 1000 + i * 500, stakedAt: Date.now() - (90 + i * 30) * 86400000,
      unlockAt: i === 2 ? Date.now() + 14 * 86400000 : undefined,
      status: i < 2 ? 'staked' : 'unstaking', rewardsEarned: 50 + i * 25,
      rewardsClaimed: 30 + i * 15, votingPower: 1000 + i * 500, txHash: `0x${'b'.repeat(64)}`,
    })),
    stats: { totalStaked: 2847000, totalStakers: 1234, currentAPY: 8.5, rewardsDistributed: 142000, nextRewardEpoch: Date.now() + 86400000, minStakeAmount: 100, unstakeCooldownDays: 14 },
  })),

  http.get('*/api/staking/rewards', () => ok(Array.from({ length: 5 }, (_, i) => ({
    id: `reward-${i}`, amount: 10 + i * 5, currency: 'AETHEL', earnedAt: Date.now() - i * 86400000 * 7,
    claimedAt: i < 3 ? Date.now() - i * 86400000 * 5 : undefined, epoch: 240 + i, txHash: i < 3 ? `0x${'c'.repeat(64)}` : undefined,
  })))),

  http.post('*/api/staking', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return ok({ id: `stake-${Date.now()}`, staker: `aeth1${'s'.repeat(38)}`, amount: body.amount || 100, stakedAt: Date.now(), status: 'staked', rewardsEarned: 0, rewardsClaimed: 0, votingPower: body.amount || 100, txHash: `0x${'c'.repeat(64)}` }, 201);
  }),

  // ── Community ─────────────────────────────────────────────────────────────

  http.get('*/api/community/circles', ({ request }) => {
    const url = new URL(request.url);
    const view = url.searchParams.get('view');

    // When view=memberships, return CircleMembership[]
    if (view === 'memberships') {
      return ok(Array.from({ length: 5 }, (_, i) => ({
        id: `membership-${String(i).padStart(4, '0')}`,
        circleId: `circle-${String(i).padStart(4, '0')}`,
        userId: `aeth1${'u'.repeat(38)}`,
        joinedAt: Date.now() - (30 + i * 10) * 86400000,
        role: i === 0 ? 'moderator' : 'member',
        zkpProofId: i < 4 ? `proof-${i}` : undefined,
      })));
    }

    const CIRCLE_NAMES: Record<string, string> = {
      fertility: 'Fertility Journeys',
      pregnancy: 'Expecting Together',
      menopause: 'Menopause Matters',
      endometriosis: 'Endo Warriors',
      pcos: 'PCOS Support Circle',
      general_wellness: 'Wellness Hub',
      mental_health: 'Mindful Health',
      nutrition: 'Nourish & Thrive',
    };
    const DESCRIPTIONS: Record<string, string> = {
      fertility: 'Fertility journeys, IVF, conception support',
      pregnancy: 'Pregnancy support, prenatal care, birth planning',
      menopause: 'Menopause transitions, HRT discussions, symptom management',
      endometriosis: 'Endometriosis warriors, treatment options, shared experiences',
      pcos: 'PCOS management, hormone balance, lifestyle strategies',
      general_wellness: 'General health and wellness discussions',
      mental_health: 'Mental health support and mindfulness',
      nutrition: 'Nutrition guidance and healthy eating',
    };
    const categories = ['fertility', 'pregnancy', 'menopause', 'endometriosis', 'pcos', 'general_wellness', 'mental_health', 'nutrition'];
    return ok(categories.map((cat, i) => ({
      id: `circle-${String(i).padStart(4, '0')}`,
      name: CIRCLE_NAMES[cat] || cat,
      category: cat,
      description: DESCRIPTIONS[cat] || `Support and discussion for ${cat.replace(/_/g, ' ')}`,
      memberCount: 500 + i * 150, postCount: 200 + i * 80,
      createdAt: Date.now() - 365 * 86400000,
      isJoined: i < 5,
      requiresZKP: i < 4,
      zkpClaimType: i < 4 ? 'condition_present' : undefined,
      icon: ['Heart', 'Baby', 'Flame', 'Ribbon', 'CircleDot', 'Leaf', 'Brain', 'Apple'][i],
      color: ['#a78bfa', '#f43f5e', '#fb923c', '#eab308', '#06b6d4', '#10b981', '#8B1538', '#84cc16'][i],
    })));
  }),

  http.get('*/api/community/circles/:id', ({ params }) => ok({
    id: params.id, name: 'Fertility Journeys', category: 'fertility',
    description: 'Fertility journeys, IVF, conception support',
    memberCount: 847, postCount: 1245, createdAt: Date.now() - 365 * 86400000,
    isJoined: true, requiresZKP: true, zkpClaimType: 'condition_present',
    icon: 'Heart', color: '#a78bfa',
  })),

  http.post('*/api/community/circles/:id', async () => ok({ joined: true })),

  http.get('*/api/community/posts', ({ request }) => {
    const url = new URL(request.url);
    const circleId = url.searchParams.get('circleId');
    return ok(Array.from({ length: 8 }, (_, i) => ({
      id: `post-${String(i).padStart(4, '0')}`, circleId: circleId || 'circle-0001',
      anonymousId: `anon-${String(i).padStart(6, '0')}`,
      content: `Community discussion post about health topics. Post #${i + 1}.`,
      timestamp: Date.now() - i * 3600000 * 4,
      reactions: [{ emoji: 'heart', count: 5 + i }, { emoji: 'support', count: 3 + i }],
      replyCount: i * 2, zkpVerified: i % 2 === 0, tags: ['support', 'experience'],
    })));
  }),

  http.post('*/api/community/posts', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return ok({ id: `post-${Date.now()}`, circleId: body.circleId, anonymousId: `anon-${Date.now()}`, content: body.content, timestamp: Date.now(), reactions: [], replyCount: 0, zkpVerified: false, tags: body.tags || [] }, 201);
  }),

  // ── Rewards ───────────────────────────────────────────────────────────────

  http.get('*/api/rewards', () => ok({
    stats: { totalEarned: 1247, totalClaimed: 982, pendingRewards: 265, activeStreaks: 4, rank: 87, level: 5, nextLevelThreshold: 1500 },
    streaks: [
      { action: 'data_upload', currentStreak: 12, longestStreak: 18, lastActionAt: Date.now() - 3600000, nextMilestone: 14, multiplier: 1.5 },
      { action: 'wearable_sync', currentStreak: 28, longestStreak: 42, lastActionAt: Date.now() - 7200000, nextMilestone: 30, multiplier: 2.0 },
      { action: 'community_post', currentStreak: 5, longestStreak: 10, lastActionAt: Date.now() - 86400000, nextMilestone: 7, multiplier: 1.2 },
      { action: 'health_checkup', currentStreak: 3, longestStreak: 6, lastActionAt: Date.now() - 86400000 * 7, nextMilestone: 4, multiplier: 1.0 },
    ],
  })),

  http.get('*/api/rewards/history', () => ok(Array.from({ length: 10 }, (_, i) => ({
    id: `reward-${String(i).padStart(4, '0')}`,
    action: ['data_upload', 'wearable_sync', 'community_post', 'health_checkup', 'data_contribution', 'streak_bonus', 'milestone', 'referral', 'data_upload', 'wearable_sync'][i],
    description: `Earned reward for ${['uploading health record', 'syncing wearable', 'community post', 'health checkup', 'research contribution', 'streak bonus', 'milestone reached', 'referral bonus', 'uploading record', 'syncing data'][i]}`,
    amount: [5, 2, 1, 10, 25, 5, 50, 20, 5, 2][i], currency: 'AETHEL',
    earnedAt: Date.now() - i * 86400000,
    claimedAt: i < 7 ? Date.now() - i * 86400000 + 3600000 : undefined,
    txHash: i < 7 ? `0x${'e'.repeat(64)}` : undefined,
  })))),

  // ── Research ──────────────────────────────────────────────────────────────

  http.get('*/api/research/studies', () => ok(Array.from({ length: 4 }, (_, i) => ({
    id: `study-${String(i).padStart(4, '0')}`,
    title: ['Endometriosis Biomarker Discovery', 'Menstrual Cycle Variability and Stress', 'Wearable-Derived Fertility Prediction', 'Hormonal Patterns in PCOS'][i],
    description: `Research study focusing on ${['biomarker discovery', 'cycle variability', 'fertility prediction', 'PCOS patterns'][i]}.`,
    institution: ['Stanford Medicine', 'MIT CSAIL', 'Johns Hopkins', 'Mayo Clinic'][i],
    principalInvestigator: [`Dr. ${['Chen', 'Kumar', 'Anderson', 'Williams'][i]}`],
    status: ['recruiting', 'active', 'active', 'completed'][i],
    participantCount: 50 + i * 30, targetParticipants: 200,
    dataTypesRequired: ['lab_result', 'vitals'], compensationShio: 50 + i * 25,
    irbApprovalId: `IRB-2024-${1000 + i}`,
    startDate: Date.now() - (180 - i * 30) * 86400000, endDate: Date.now() + (180 + i * 30) * 86400000,
    zkpRequired: i < 2,
  })))),

  http.post('*/api/research/studies', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return ok({ id: `contribution-${Date.now()}`, studyId: body.studyId, status: 'enrolled', enrolledAt: Date.now() }, 201);
  }),

  // ── Providers / Reputation ────────────────────────────────────────────────

  http.get('*/api/providers/reputation', () => ok(Array.from({ length: 5 }, (_, i) => ({
    address: `aeth1provider${String(i).padStart(34, '0')}`,
    name: ['Dr. Sarah Chen', "Metro Women's Health", 'Dr. James Liu', 'Fertility Clinic', "Stanford Women's Care"][i],
    specialty: ['OB-GYN', 'Primary Care', 'Endocrinology', 'Reproductive Medicine', 'Gynecology'][i],
    trustLevel: ['gold', 'gold', 'silver', 'silver', 'bronze'][i],
    overallScore: 95 - i * 5, reviewCount: 20 + i * 5, totalAccesses: 100 + i * 30,
    onTimeRevocations: 98 - i, dataBreaches: 0, averageAccessDuration: 30 + i * 10,
    registeredAt: Date.now() - (365 + i * 90) * 86400000, lastActivityAt: Date.now() - i * 86400000 * 3,
  })))),

  http.get('*/api/providers/:address', ({ params }) => ok({
    address: params.address, name: 'Dr. Sarah Chen', specialty: 'OB-GYN',
    trustLevel: 'gold', overallScore: 95, reviewCount: 24, totalAccesses: 142,
    onTimeRevocations: 98, dataBreaches: 0, averageAccessDuration: 45,
    registeredAt: Date.now() - 365 * 86400000, lastActivityAt: Date.now() - 86400000,
  })),

  // ── XAI (Explainable AI) ──────────────────────────────────────────────────

  http.get('*/api/xai/shap', () => ok({
    inferenceId: 'inf-001', modelId: 'lstm',
    shapValues: [
      { feature: 'cycle_length', value: 28, baseValue: 27.5, contribution: 0.35 },
      { feature: 'temperature_shift', value: 0.5, baseValue: 0.4, contribution: 0.25 },
      { feature: 'lh_surge', value: 42, baseValue: 35, contribution: 0.20 },
      { feature: 'cervical_mucus', value: 3, baseValue: 2, contribution: 0.12 },
      { feature: 'age', value: 31, baseValue: 30, contribution: 0.08 },
    ],
    featureImportances: [
      { feature: 'cycle_length', importance: 0.35, direction: 'positive' },
      { feature: 'temperature_shift', importance: 0.25, direction: 'positive' },
      { feature: 'lh_surge', importance: 0.20, direction: 'positive' },
      { feature: 'cervical_mucus', importance: 0.12, direction: 'neutral' },
      { feature: 'age', importance: 0.08, direction: 'negative' },
    ],
    decisionPath: ['Input normalization', 'Feature extraction', 'LSTM forward pass', 'Attention weighting', 'Output classification'],
    confidence: 96.2,
    explanation: 'The model predicts normal ovulation timing based primarily on consistent cycle length and clear temperature shift.',
  })),

  http.get('*/api/xai/model-cards', () => ok([
    { modelId: 'lstm', name: 'Cycle LSTM', version: 'v2.1', description: 'Predicts menstrual cycle timing using LSTM neural network.', architecture: 'LSTM', trainingDataSize: 125000, validationAccuracy: 96.2, fairnessMetrics: { demographicParity: 0.95, equalizedOdds: 0.92, calibration: 0.97 }, limitations: ['Requires minimum 3 cycles of data', 'Less accurate for irregular cycles'], intendedUse: 'Menstrual cycle timing prediction', lastUpdated: Date.now() - 30 * 86400000 },
    { modelId: 'anomaly', name: 'Anomaly Detector', version: 'v1.4', description: 'Detects unusual health patterns using Isolation Forest.', architecture: 'Isolation Forest', trainingDataSize: 85000, validationAccuracy: 93.8, fairnessMetrics: { demographicParity: 0.93, equalizedOdds: 0.90, calibration: 0.94 }, limitations: ['May produce false positives during lifestyle changes', 'Requires continuous data stream'], intendedUse: 'Health anomaly detection and alerting', lastUpdated: Date.now() - 45 * 86400000 },
  ])),

  http.get('*/api/xai/bias', () => ok([
    { modelId: 'lstm', reportId: 'bias-001', generatedAt: Date.now() - 7 * 86400000, overallFairness: 0.94, metrics: { demographicParity: 0.95, equalizedOdds: 0.92 }, recommendations: ['Monitor age-group disparities', 'Add ethnicity-aware calibration'] },
    { modelId: 'anomaly', reportId: 'bias-002', generatedAt: Date.now() - 14 * 86400000, overallFairness: 0.91, metrics: { demographicParity: 0.93, equalizedOdds: 0.90 }, recommendations: ['Review false positive rates across demographics'] },
  ])),

  // ── Privacy (GDPR) ────────────────────────────────────────────────────────

  http.post('*/api/privacy/access-request', async () => ok({ id: `sar-${Date.now()}`, type: 'access', status: 'processing', requestedAt: Date.now(), estimatedCompletionAt: Date.now() + 30 * 86400000 }, 201)),
  http.post('*/api/privacy/erasure', async () => ok({ id: `erasure-${Date.now()}`, type: 'erasure', status: 'processing', requestedAt: Date.now(), estimatedCompletionAt: Date.now() + 30 * 86400000 }, 201)),
  http.post('*/api/privacy/portability', async () => ok({ id: `port-${Date.now()}`, type: 'portability', status: 'processing', requestedAt: Date.now(), estimatedCompletionAt: Date.now() + 7 * 86400000, format: 'json' }, 201)),

  // ── IPFS ──────────────────────────────────────────────────────────────────

  http.post('*/api/ipfs/upload', async () => ok({ cid: `Qm${'u'.repeat(44)}`, size: 1024 * 50, txHash: `0x${'f'.repeat(64)}`, encryptionKey: `0x${'a'.repeat(64)}` }, 201)),
  http.get('*/api/ipfs/:cid', ({ params }) => ok({ cid: params.cid, data: 'encrypted_data_placeholder', size: 1024 * 50, metadata: { encrypted: true, encryption: 'AES-256-GCM' } })),
];
