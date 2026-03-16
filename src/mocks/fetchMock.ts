// ============================================================
// Fetch Mock — intercepts global.fetch calls during tests and
// returns the same JSON data that the MSW handlers produce,
// without requiring MSW's node server (which has ESM/polyfill
// issues with Jest + jsdom).
// ============================================================

type Handler = (url: URL, init?: RequestInit) => object | null;

// ---------------------------------------------------------------------------
// Response helpers
// ---------------------------------------------------------------------------

function ok<T>(data: T) {
  return { success: true, data };
}

function paginated<T>(data: T[], meta: { page: number; limit: number; total: number }) {
  return { success: true, data, meta: { ...meta, totalPages: Math.ceil(meta.total / meta.limit) } };
}

// ---------------------------------------------------------------------------
// Mock Data (same as handlers.ts)
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

const CIRCLE_DESCRIPTIONS: Record<string, string> = {
  fertility: 'Fertility journeys, IVF, conception support',
  pregnancy: 'Pregnancy support, prenatal care, birth planning',
  menopause: 'Menopause transitions, HRT discussions, symptom management',
  endometriosis: 'Endometriosis warriors, treatment options, shared experiences',
  pcos: 'PCOS management, hormone balance, lifestyle strategies',
  general_wellness: 'General health and wellness discussions',
  mental_health: 'Mental health support and mindfulness',
  nutrition: 'Nutrition guidance and healthy eating',
};

const CATEGORIES = ['fertility', 'pregnancy', 'menopause', 'endometriosis', 'pcos', 'general_wellness', 'mental_health', 'nutrition'];

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

const routes: Array<{ method: string; pattern: RegExp; handler: Handler }> = [
  // ── Wallet ──────────────────────────────────────────────────────────────
  {
    method: 'GET',
    pattern: /\/api\/wallet\/challenge/,
    handler: (url) => {
      const address = url.searchParams.get('address') || '0x0000000000000000000000000000000000000000';
      return ok({
        message: `Shiora on Aethelred — Wallet Authentication\n\nAddress: ${address}\nNonce: mock-nonce-123\n\nSign this message to authenticate.`,
        nonce: 'mock-nonce-123',
        issuedAt: Date.now(),
        expiresAt: Date.now() + 300000,
        hmac: 'mock-hmac-value',
      });
    },
  },
  {
    method: 'POST',
    pattern: /\/api\/wallet\/connect/,
    handler: () => ok({
      address: 'aeth1mockaddress',
      expiresAt: Date.now() + 86400000,
      expiresIn: '24h',
      session: { transport: 'httpOnly-cookie', cookieName: 'shiora_session' },
      balances: { aethel: 48250.42 },
      profile: { recordCount: 147, activeGrants: 3, lastActivity: Date.now() - 3600000, memberSince: Date.now() - 180 * 86400000 },
    }),
  },
  {
    method: 'DELETE',
    pattern: /\/api\/wallet\/connect/,
    handler: () => ok({ disconnected: true }),
  },
  {
    method: 'GET',
    pattern: /\/api\/wallet\/connect/,
    handler: () => ok({ address: 'aeth1mock', expiresAt: Date.now() + 86400000 }),
  },

  // ── Records ─────────────────────────────────────────────────────────────
  {
    method: 'GET',
    pattern: /\/api\/records$/,
    handler: (url) => {
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
    },
  },
  {
    method: 'GET',
    pattern: /\/api\/records\/[^/]+$/,
    handler: (url) => {
      const id = url.pathname.split('/').pop();
      const record = mockRecords.find((r) => r.id === id);
      if (!record) return { success: false, error: { code: 'NOT_FOUND', message: 'Record not found' } };
      return ok(record);
    },
  },
  {
    method: 'POST',
    pattern: /\/api\/records$/,
    handler: () => ok({ id: `rec-${Date.now()}`, date: Date.now(), encrypted: true, encryption: 'AES-256-GCM', cid: `Qm${'d'.repeat(44)}`, txHash: `0x${'e'.repeat(64)}`, status: 'Processing' }),
  },

  // ── Access Grants ───────────────────────────────────────────────────────
  {
    method: 'GET',
    pattern: /\/api\/access\/audit/,
    handler: () => {
      const entries = Array.from({ length: 8 }, (_, i) => ({
        id: `audit-${i}`,
        provider: `Dr. Provider ${i % 5}`,
        action: ['Viewed records', 'Downloaded report', 'Access granted', 'Access revoked'][i % 4],
        timestamp: Date.now() - i * 3600000,
        details: `Audit entry ${i}`,
        txHash: `0x${'c'.repeat(64)}`,
        type: ['access', 'download', 'grant', 'revoke'][i % 4],
      }));
      return ok(entries);
    },
  },
  {
    method: 'GET',
    pattern: /\/api\/access$/,
    handler: (url) => {
      const status = url.searchParams.get('status');
      const grants = Array.from({ length: 5 }, (_, i) => ({
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
      const filtered = status && status !== 'all' ? grants.filter((g) => g.status === status) : grants;
      return paginated(filtered, { page: 1, limit: 20, total: filtered.length });
    },
  },

  // ── Insights ────────────────────────────────────────────────────────────
  {
    method: 'GET',
    pattern: /\/api\/insights$/,
    handler: () => ok({
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
    }),
  },
  {
    method: 'GET',
    pattern: /\/api\/insights\/anomalies/,
    handler: () => ok({ anomalies: [], total: 0 }),
  },
  {
    method: 'GET',
    pattern: /\/api\/insights\/inferences/,
    handler: () => ok({ inferences: [], total: 0 }),
  },

  // ── TEE Status ──────────────────────────────────────────────────────────
  {
    method: 'GET',
    pattern: /\/api\/tee\/status/,
    handler: (url) => {
      const include = url.searchParams.get('include');
      if (include === 'inferences') return ok([
        { id: 'inf-001', model: 'lstm', input: 'test', result: 'Anomaly Detected', confidence: 96.2, timestamp: Date.now() - 3600000, attestation: '0xabc' },
        { id: 'inf-002', model: 'anomaly', input: 'test2', result: 'Normal', confidence: 93.8, timestamp: Date.now() - 7200000, attestation: '0xdef' },
        { id: 'inf-003', model: 'lstm', input: 'test3', result: 'Normal', confidence: 91.5, timestamp: Date.now() - 10800000, attestation: '0xghi' },
      ]);
      if (include === 'models') return ok([
        { id: 'lstm', name: 'Health LSTM', version: '3.2', accuracy: 96.5, lastUpdated: Date.now() - 86400000, teePlatform: 'Intel SGX' },
      ]);
      return ok({ status: 'operational', platform: 'Intel SGX', attestationsToday: 342, enclaveUptime: 99.97, inferencesCompleted: 12847 });
    },
  },
  {
    method: 'GET',
    pattern: /\/api\/tee\/attestations/,
    handler: () => ok([]),
  },
  // ── TEE Explorer ──────────────────────────────────────────────────────
  {
    method: 'GET',
    pattern: /\/api\/tee\/explorer/,
    handler: (url) => {
      const view = url.searchParams.get('view');
      if (view === 'stats') return ok({ totalEnclaves: 5, activeEnclaves: 4, totalAttestations: 1200, totalJobs: 340 });
      if (view === 'attestations') return ok([]);
      if (view === 'jobs') return ok([]);
      if (view === 'enclaves') return ok([]);
      return ok({ totalEnclaves: 5, activeEnclaves: 4 });
    },
  },

  // ── Health / Network ────────────────────────────────────────────────────
  {
    method: 'GET',
    pattern: /\/api\/health$/,
    handler: () => ok({ status: 'healthy', uptime: 99.99 }),
  },
  {
    method: 'GET',
    pattern: /\/api\/network\/status/,
    handler: () => ok({
      blockHeight: 2847391, tps: 2150, epoch: 247, networkLoad: 72, aethelPrice: 1.24,
      recentBlocks: Array.from({ length: 5 }, (_, i) => ({
        height: 2847391 - i, hash: `0x${'a'.repeat(64)}`, txCount: 10 + i,
        proposer: `aeth1val${i}`, timestamp: Date.now() - i * 3000, gasUsed: 50000 + i * 1000,
      })),
    }),
  },

  // ── Chat ────────────────────────────────────────────────────────────────
  {
    method: 'GET',
    pattern: /\/api\/chat\/conversations/,
    handler: () => ok(Array.from({ length: 8 }, (_, i) => ({
      id: `conv-${String(i).padStart(4, '0')}`,
      title: ['Cycle Analysis Discussion', 'Lab Results Review', 'Fertility Planning', 'Medication Questions', 'Sleep Pattern Analysis', 'Wellness Check-in', 'Hormone Level Discussion', 'Nutrition Guidance'][i],
      createdAt: Date.now() - (8 - i) * 86400000 * 2,
      updatedAt: Date.now() - i * 3600000 * 3,
      messageCount: 6 + i * 3,
      lastMessage: 'Based on your cycle data from the last 6 months...',
      model: 'Health Transformer',
      totalTokens: 2500 + i * 300,
      attestationCount: 3 + i,
    }))),
  },
  {
    method: 'GET',
    pattern: /\/api\/chat\/[^/]+$/,
    handler: (url) => {
      const id = url.pathname.split('/').pop();
      return ok({
        id,
        messages: Array.from({ length: 4 }, (_, i) => ({
          id: `msg-${i}`,
          conversationId: id,
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: i % 2 === 0 ? 'Analyze my recent cycle data' : 'Your cycle data shows consistent 28-day patterns with normal BBT shifts.',
          timestamp: Date.now() - (4 - i) * 60000,
          attestation: i % 2 === 1 ? `0x${'b'.repeat(64)}` : undefined,
          model: i % 2 === 1 ? 'Cycle LSTM' : undefined,
          confidence: i % 2 === 1 ? 96 : undefined,
        })),
      });
    },
  },
  {
    method: 'GET',
    pattern: /\/api\/chat$/,
    handler: () => ok(Array.from({ length: 6 }, (_, i) => ({
      id: `conv-${String(i).padStart(4, '0')}`,
      title: ['Cycle Analysis', 'Lab Results Review', 'Fertility Planning', 'Medication Questions', 'Sleep Analysis', 'Wellness Check'][i],
      createdAt: Date.now() - (6 - i) * 86400000 * 2,
      updatedAt: Date.now() - i * 3600000 * 3,
      messageCount: 8 + i * 2,
      lastMessage: 'Based on your recent data, I can provide some insights...',
      model: 'Health Transformer',
      totalTokens: 3000 + i * 500,
      attestationCount: 4 + i,
    }))),
  },
  {
    method: 'POST',
    pattern: /\/api\/chat$/,
    handler: () => ok({ id: `msg-${Date.now()}`, conversationId: 'conv-0001', role: 'assistant', content: 'Based on your health data processed in the TEE enclave, your cycle patterns appear consistent with healthy variation.', timestamp: Date.now(), attestation: `0x${'a'.repeat(64)}`, model: 'Health Transformer', confidence: 94, teePlatform: 'Intel SGX', tokens: 280 }),
  },

  // ── Vault ───────────────────────────────────────────────────────────────
  {
    method: 'GET',
    pattern: /\/api\/vault\/compartments\/[^/]+$/,
    handler: (url) => {
      const id = url.pathname.split('/').pop();
      return ok({
        id, category: 'cycle_tracking', label: 'Cycle Tracking',
        description: 'Encrypted cycle tracking compartment', lockStatus: 'locked',
        recordCount: 45, storageUsed: 120 * 1024 * 1024, lastAccessed: Date.now() - 3600000,
        encryptionKey: `0x${'f'.repeat(64)}`, accessListCount: 2,
        jurisdictionFlags: ['us-ca', 'eu-gdpr'], createdAt: Date.now() - 180 * 86400000,
      });
    },
  },
  {
    method: 'GET',
    pattern: /\/api\/vault\/compartments/,
    handler: () => {
      const categories = ['cycle_tracking', 'fertility_data', 'hormone_levels', 'medications', 'lab_results', 'imaging', 'symptoms', 'pregnancy'];
      return ok(categories.map((cat, i) => ({
        id: `vault-${String(i).padStart(4, '0')}`, category: cat,
        label: cat.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
        description: `Encrypted ${cat.replace(/_/g, ' ')} compartment`,
        lockStatus: i < 3 ? 'locked' : 'unlocked', recordCount: 10 + i * 8,
        storageUsed: (50 + i * 20) * 1024 * 1024, lastAccessed: Date.now() - i * 86400000,
        encryptionKey: `0x${'f'.repeat(64)}`, accessListCount: i % 3,
        jurisdictionFlags: ['us-ca', 'eu-gdpr'], createdAt: Date.now() - (180 + i * 30) * 86400000,
      })));
    },
  },
  {
    method: 'GET',
    pattern: /\/api\/vault\/cycle/,
    handler: () => ok(Array.from({ length: 28 }, (_, i) => ({
      id: `cycle-${i}`, date: Date.now() - (28 - i) * 86400000, day: i + 1,
      phase: i < 5 ? 'menstrual' : i < 13 ? 'follicular' : i < 16 ? 'ovulation' : 'luteal',
      temperature: parseFloat((97.0 + (i >= 14 ? 0.5 : 0) + Math.random() * 0.4).toFixed(1)),
      flow: i < 5 ? (['light', 'medium', 'heavy', 'medium', 'light'] as const)[i] : 'none',
      symptoms: [] as string[], fertilityScore: i >= 10 && i <= 16 ? 70 + (i - 10) * 5 : 20, notes: '',
    }))),
  },
  {
    method: 'GET',
    pattern: /\/api\/vault\/symptoms/,
    handler: () => ok(Array.from({ length: 5 }, (_, i) => ({
      id: `sym-${i}`, date: Date.now() - i * 86400000,
      category: ['pain', 'mood', 'energy', 'digestive', 'sleep'][i],
      symptom: ['Cramps', 'Fatigue', 'Low energy', 'Bloating', 'Insomnia'][i],
      severity: (i % 4 + 1), notes: '', tags: [] as string[],
    }))),
  },
  // ── Consent ─────────────────────────────────────────────────────────────
  {
    method: 'GET',
    pattern: /\/api\/consent\/policies/,
    handler: () => ok([
      { id: 'policy-0', name: 'Standard Access', description: 'Standard data access policy', scopes: ['cycle_data', 'lab_results'], defaultDurationDays: 90 },
      { id: 'policy-1', name: 'Research Access', description: 'Access for approved research', scopes: ['anonymized_data'], defaultDurationDays: 365 },
      { id: 'policy-2', name: 'Emergency Access', description: 'Emergency healthcare data access', scopes: ['cycle_data', 'lab_results', 'vitals'], defaultDurationDays: 7 },
      { id: 'policy-3', name: 'Specialist Referral', description: 'Referral data sharing with specialist', scopes: ['lab_results'], defaultDurationDays: 30 },
      { id: 'policy-4', name: 'Full Access', description: 'Comprehensive data access for primary care', scopes: ['cycle_data', 'lab_results', 'vitals', 'medications'], defaultDurationDays: 180 },
    ]),
  },
  {
    method: 'GET',
    pattern: /\/api\/consent\/[^/]+$/,
    handler: (url) => {
      const id = url.pathname.split('/').pop();
      return ok({
        id, patientAddress: `aeth1${'p'.repeat(38)}`, providerAddress: `aeth1${'q'.repeat(38)}`,
        providerName: 'Dr. Provider 0', scopes: ['cycle_data'], status: 'active',
        grantedAt: Date.now() - 30 * 86400000, expiresAt: Date.now() + 60 * 86400000,
        txHash: `0x${'d'.repeat(64)}`, attestation: `0x${'e'.repeat(64)}`,
        policyId: 'policy-0', autoRenew: true,
      });
    },
  },
  {
    method: 'GET',
    pattern: /\/api\/consent$/,
    handler: (url) => {
      const status = url.searchParams.get('status');
      const scope = url.searchParams.get('scope');
      const q = url.searchParams.get('q');
      const audit = url.searchParams.get('audit');
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '50');

      if (audit === 'true') {
        const auditEntries = Array.from({ length: 10 }, (_, i) => ({
          id: `audit-${String(i).padStart(4, '0')}`,
          consentId: `consent-${String(i % 5).padStart(4, '0')}`,
          action: ['granted', 'revoked', 'modified', 'renewed', 'expired'][i % 5],
          performedBy: `aeth1${'a'.repeat(38)}`,
          timestamp: Date.now() - i * 86400000,
          txHash: `0x${'f'.repeat(64)}`,
          details: `Audit action ${i}`,
        }));
        return paginated(auditEntries, { page: 1, limit: 20, total: auditEntries.length });
      }

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
    },
  },
  {
    method: 'POST',
    pattern: /\/api\/consent$/,
    handler: () => ok({ id: `consent-${Date.now()}`, status: 'pending', grantedAt: Date.now(), txHash: `0x${'f'.repeat(64)}`, attestation: `0x${'a'.repeat(64)}` }),
  },

  // ── Marketplace ─────────────────────────────────────────────────────────
  {
    method: 'GET',
    pattern: /\/api\/marketplace\/stats/,
    handler: (url) => {
      const type = url.searchParams.get('type');
      if (type === 'revenue') {
        return ok(Array.from({ length: 7 }, (_, i) => ({
          day: new Date(Date.now() - (6 - i) * 86400000).toISOString().slice(0, 10),
          revenue: 120 + i * 30,
          transactions: 5 + i * 2,
        })));
      }
      return ok({
        totalListings: 847, activeListings: 312, totalVolume: 45200, totalSellers: 234, totalBuyers: 891, averagePrice: 32.5,
        topCategories: [
          { category: 'menstrual_cycles', count: 120, volume: 12400 },
          { category: 'lab_results', count: 85, volume: 8900 },
          { category: 'wearable_data', count: 72, volume: 6300 },
        ],
      });
    },
  },
  {
    method: 'GET',
    pattern: /\/api\/marketplace\/[^/]+$/,
    handler: (url) => {
      const id = url.pathname.split('/').pop();
      return ok({
        id, seller: `aeth1${'s'.repeat(38)}`, sellerReputation: 92,
        category: 'menstrual_cycles', title: 'Anonymized Cycle Dataset',
        description: 'High-quality anonymized cycle tracking data.', dataPoints: 1200,
        qualityScore: 94, anonymizationLevel: 'differential-privacy',
        price: 45, currency: 'AETHEL', status: 'active', teeVerified: true,
        attestation: `0x${'a'.repeat(64)}`, purchaseCount: 12,
        createdAt: Date.now() - 30 * 86400000, expiresAt: Date.now() + 60 * 86400000,
      });
    },
  },
  {
    method: 'GET',
    pattern: /\/api\/marketplace$/,
    handler: (url) => {
      const purchases = url.searchParams.get('purchases');
      if (purchases === 'true') {
        return ok(Array.from({ length: 3 }, (_, i) => ({
          id: `purchase-${String(i).padStart(4, '0')}`,
          listingId: `listing-${String(i).padStart(4, '0')}`,
          buyer: `aeth1${'b'.repeat(38)}`,
          price: 25 + i * 15,
          currency: 'AETHEL',
          purchasedAt: Date.now() - i * 86400000 * 5,
          txHash: `0x${'d'.repeat(64)}`,
          status: 'completed',
        })));
      }
      const category = url.searchParams.get('category');
      const search = url.searchParams.get('search');
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
      let filtered = category ? listings.filter((l) => l.category === category) : listings;
      if (search) {
        const q = search.toLowerCase();
        filtered = filtered.filter((l) => l.title.toLowerCase().includes(q) || l.description.toLowerCase().includes(q));
      }
      return ok(filtered);
    },
  },

  // ── Wearables ───────────────────────────────────────────────────────────
  {
    method: 'GET',
    pattern: /\/api\/wearables\/sync/,
    handler: () => ok(Array.from({ length: 5 }, (_, i) => ({
      id: `sync-${String(i).padStart(4, '0')}`,
      deviceId: `dev-${String((i % 3) + 1).padStart(3, '0')}`,
      syncedAt: Date.now() - i * 3600000 * 6,
      dataPointCount: 100 + i * 30,
      attestation: `0x${'b'.repeat(64)}`,
      status: i < 3 ? 'completed' : 'processing',
    }))),
  },
  {
    method: 'POST',
    pattern: /\/api\/wearables\/sync/,
    handler: () => ok({ id: `sync-${Date.now()}`, deviceId: 'dev-001', syncedAt: Date.now(), dataPointCount: 142, attestation: `0x${'b'.repeat(64)}`, status: 'completed' }),
  },
  {
    method: 'GET',
    pattern: /\/api\/wearables$/,
    handler: (url) => {
      const view = url.searchParams.get('view');
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
    },
  },
  {
    method: 'GET',
    pattern: /\/api\/wearables\/[^/]+$/,
    handler: (url) => {
      const provider = url.pathname.split('/').pop();
      return ok({
        id: `dev-${provider}`, provider, deviceName: `${String(provider).replace('_', ' ')} Device`,
        status: 'connected', lastSync: Date.now() - 3600000, dataPointsSynced: 5000, connectedAt: Date.now() - 60 * 86400000,
      });
    },
  },

  // ── FHIR ────────────────────────────────────────────────────────────────
  {
    method: 'GET',
    pattern: /\/api\/fhir\/import/,
    handler: () => ok([
      { id: 'import-001', source: 'Epic MyChart Export', resourceCount: 24, processedCount: 24, failedCount: 0, status: 'completed', startedAt: Date.now() - 86400000 * 2, completedAt: Date.now() - 86400000 * 2 + 300000, errors: [] },
      { id: 'import-002', source: 'Cerner Health Portal', resourceCount: 18, processedCount: 15, failedCount: 3, status: 'completed', startedAt: Date.now() - 86400000 * 5, completedAt: Date.now() - 86400000 * 5 + 600000, errors: ['Invalid Observation format', 'Missing required field', 'Duplicate resource'] },
      { id: 'import-003', source: 'FHIR Bundle Upload', resourceCount: 10, processedCount: 0, failedCount: 0, status: 'processing', startedAt: Date.now() - 3600000, errors: [] },
    ]),
  },
  {
    method: 'POST',
    pattern: /\/api\/fhir\/import/,
    handler: () => ok({ id: `import-${Date.now()}`, source: 'external', resourceCount: 25, processedCount: 0, failedCount: 0, status: 'processing', startedAt: Date.now(), errors: [] }),
  },
  {
    method: 'GET',
    pattern: /\/api\/fhir\/mapping/,
    handler: () => ok([
      { id: 'map-001', fhirResourceType: 'Observation', shioraRecordType: 'vitals', fieldMappings: [{ fhirPath: 'Observation.value', shioraField: 'value' }], isDefault: true },
      { id: 'map-002', fhirResourceType: 'DiagnosticReport', shioraRecordType: 'lab_result', fieldMappings: [{ fhirPath: 'DiagnosticReport.result', shioraField: 'results' }], isDefault: true },
      { id: 'map-003', fhirResourceType: 'MedicationRequest', shioraRecordType: 'prescription', fieldMappings: [{ fhirPath: 'MedicationRequest.medication', shioraField: 'medication' }], isDefault: true },
    ]),
  },
  {
    method: 'GET',
    pattern: /\/api\/fhir\/export/,
    handler: () => ok([{ id: 'export-001', format: 'json', resourceTypes: ['Observation', 'MedicationRequest'], destination: 'ipfs', lastExportAt: Date.now() - 86400000 }]),
  },
  {
    method: 'GET',
    pattern: /\/api\/fhir$/,
    handler: () => ok(Array.from({ length: 5 }, (_, i) => ({
      id: `fhir-${String(i).padStart(4, '0')}`,
      resourceType: ['Patient', 'Observation', 'MedicationRequest', 'Condition', 'DiagnosticReport'][i],
      status: 'active', lastUpdated: Date.now() - i * 86400000, rawJson: '{}',
      mappedRecordId: i < 3 ? `rec-${String(i).padStart(4, '0')}` : undefined,
    }))),
  },

  // ── Alerts ──────────────────────────────────────────────────────────────
  {
    method: 'GET',
    pattern: /\/api\/alerts\/rules/,
    handler: () => ok([
      { id: 'rule-0', metric: 'temperature', operator: 'gt', threshold: 100.4, severity: 'critical', enabled: true, channels: ['push', 'email'] },
      { id: 'rule-1', metric: 'heart_rate', operator: 'gt', threshold: 100, severity: 'warning', enabled: true, channels: ['push'] },
    ]),
  },
  {
    method: 'GET',
    pattern: /\/api\/alerts\/history/,
    handler: () => ok(Array.from({ length: 10 }, (_, i) => ({
      id: `hist-${i}`, alertId: `alert-${i % 5}`, metric: ['temperature', 'heart_rate', 'spo2', 'cycle_length', 'hrv'][i % 5],
      severity: ['critical', 'warning', 'info'][i % 3], timestamp: Date.now() - i * 86400000,
      resolved: i > 5, resolvedAt: i > 5 ? Date.now() - (i - 2) * 86400000 : undefined,
    }))),
  },
  {
    method: 'GET',
    pattern: /\/api\/alerts$/,
    handler: () => ok(Array.from({ length: 5 }, (_, i) => ({
      id: `alert-${String(i).padStart(4, '0')}`, ruleId: `rule-${i}`,
      metric: ['temperature', 'heart_rate', 'spo2', 'cycle_length', 'hrv'][i],
      severity: ['critical', 'warning', 'info', 'warning', 'info'][i],
      title: ['High Temperature', 'Elevated Heart Rate', 'Low SpO2', 'Irregular Cycle', 'Low HRV'][i],
      message: 'Anomaly detected in health readings.',
      currentValue: [101.2, 105, 93, 38, 18][i], threshold: [100.4, 100, 94, 35, 20][i],
      triggeredAt: Date.now() - i * 3600000 * 4,
      acknowledgedAt: i > 2 ? Date.now() - i * 3600000 : undefined,
      modelId: 'anomaly', confidence: 88 + i * 2, attestation: `0x${'c'.repeat(64)}`,
    }))),
  },

  // ── ZKP ─────────────────────────────────────────────────────────────────
  {
    method: 'GET',
    pattern: /\/api\/zkp\/claims/,
    handler: (url) => {
      const view = url.searchParams.get('view');
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
    },
  },
  {
    method: 'POST',
    pattern: /\/api\/zkp\/prove/,
    handler: () => ok({ id: `proof-${Date.now()}`, claimType: 'age_range', proofHash: `0x${'e'.repeat(64)}`, publicInputs: JSON.stringify({ verified: true }), verified: false, createdAt: Date.now(), expiresAt: Date.now() + 90 * 86400000, status: 'proving' }),
  },
  {
    method: 'POST',
    pattern: /\/api\/zkp\/verify/,
    handler: () => ok({ valid: true, claimType: 'age_range', verifiedAt: Date.now(), blockHeight: 2847400, gasUsed: 145000 }),
  },

  // ── Governance ──────────────────────────────────────────────────────────
  {
    method: 'GET',
    pattern: /\/api\/governance\/proposals\/[^/]+$/,
    handler: (url) => {
      const id = url.pathname.split('/').pop();
      return ok({
        id, proposer: `aeth1${'g'.repeat(38)}`, type: 'feature',
        title: 'Add differential privacy to wearable data',
        description: 'This proposal seeks to integrate differential privacy mechanisms into the wearable data pipeline.',
        forVotes: 52000, againstVotes: 14000, abstainVotes: 3500, quorum: 100000,
        startBlock: 2847000, endBlock: 2857000, status: 'active',
        createdAt: Date.now() - 7 * 86400000, txHash: `0x${'f'.repeat(64)}`,
      });
    },
  },
  {
    method: 'GET',
    pattern: /\/api\/governance\/proposals$/,
    handler: (url) => {
      const view = url.searchParams.get('view');
      const statusFilter = url.searchParams.get('status');

      if (view === 'stats') {
        return ok({
          totalProposals: 12, activeProposals: 3, totalVoters: 1234,
          totalVotingPower: 2847000, quorumThreshold: 10, treasuryBalance: 1500000,
        });
      }

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
    },
  },
  {
    method: 'GET',
    pattern: /\/api\/governance\/vote/,
    handler: () => ok(Array.from({ length: 3 }, (_, i) => ({
      id: `vote-${String(i).padStart(4, '0')}`,
      proposalId: `prop-${String(i).padStart(4, '0')}`,
      voter: `aeth1${'v'.repeat(38)}`,
      support: ['for', 'against', 'abstain'][i],
      weight: 1200 + i * 200,
      timestamp: Date.now() - i * 86400000,
      txHash: `0x${'a'.repeat(64)}`,
    }))),
  },
  {
    method: 'POST',
    pattern: /\/api\/governance\/vote/,
    handler: () => ok({ id: `vote-${Date.now()}`, proposalId: 'prop-0001', voter: `aeth1${'v'.repeat(38)}`, support: 'for', weight: 1200, timestamp: Date.now(), txHash: `0x${'a'.repeat(64)}` }),
  },
  {
    method: 'POST',
    pattern: /\/api\/governance\/proposals/,
    handler: () => ok({ id: `prop-${Date.now()}`, status: 'active', forVotes: 0, againstVotes: 0, abstainVotes: 0, createdAt: Date.now(), txHash: `0x${'f'.repeat(64)}` }),
  },

  // ── Staking ─────────────────────────────────────────────────────────────
  {
    method: 'GET',
    pattern: /\/api\/staking\/rewards/,
    handler: () => ok(Array.from({ length: 5 }, (_, i) => ({
      id: `reward-${i}`, amount: 10 + i * 5, currency: 'AETHEL', earnedAt: Date.now() - i * 86400000 * 7,
      claimedAt: i < 3 ? Date.now() - i * 86400000 * 5 : undefined, epoch: 240 + i, txHash: i < 3 ? `0x${'c'.repeat(64)}` : undefined,
    }))),
  },
  {
    method: 'GET',
    pattern: /\/api\/staking$/,
    handler: (url) => {
      const view = url.searchParams.get('view');
      if (view === 'stats') {
        return ok({ totalStaked: 2847000, totalStakers: 1234, currentAPY: 8.5, rewardsDistributed: 142000, nextRewardEpoch: Date.now() + 86400000, minStakeAmount: 100, unstakeCooldownDays: 14 });
      }
      return ok(Array.from({ length: 3 }, (_, i) => ({
        id: `stake-${String(i).padStart(4, '0')}`, staker: `aeth1${'s'.repeat(38)}`,
        amount: 1000 + i * 500, stakedAt: Date.now() - (90 + i * 30) * 86400000,
        unlockAt: i === 2 ? Date.now() + 14 * 86400000 : undefined,
        status: i < 2 ? 'staked' : 'unstaking', rewardsEarned: 50 + i * 25,
        rewardsClaimed: 30 + i * 15, votingPower: 1000 + i * 500, txHash: `0x${'b'.repeat(64)}`,
      })));
    },
  },

  // ── Community ───────────────────────────────────────────────────────────
  {
    method: 'GET',
    pattern: /\/api\/community\/circles\/[^/]+$/,
    handler: (url) => {
      const id = url.pathname.split('/').pop();
      return ok({
        id, name: 'Fertility Journeys', category: 'fertility',
        description: 'Fertility journeys, IVF, conception support',
        memberCount: 847, postCount: 1245, createdAt: Date.now() - 365 * 86400000,
        isJoined: true, requiresZKP: true, zkpClaimType: 'condition_present',
        icon: 'Heart', color: '#a78bfa',
      });
    },
  },
  {
    method: 'POST',
    pattern: /\/api\/community\/circles\/[^/]+$/,
    handler: () => ok({ joined: true }),
  },
  {
    method: 'GET',
    pattern: /\/api\/community\/circles$/,
    handler: (url) => {
      const view = url.searchParams.get('view');
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
      return ok(CATEGORIES.map((cat, i) => ({
        id: `circle-${String(i).padStart(4, '0')}`,
        name: CIRCLE_NAMES[cat] || cat,
        category: cat,
        description: CIRCLE_DESCRIPTIONS[cat] || `Support and discussion for ${cat.replace(/_/g, ' ')}`,
        memberCount: 500 + i * 150, postCount: 200 + i * 80,
        createdAt: Date.now() - 365 * 86400000,
        isJoined: i < 5,
        requiresZKP: i < 4,
        zkpClaimType: i < 4 ? 'condition_present' : undefined,
        icon: ['Heart', 'Baby', 'Flame', 'Ribbon', 'CircleDot', 'Leaf', 'Brain', 'Apple'][i],
        color: ['#a78bfa', '#f43f5e', '#fb923c', '#eab308', '#06b6d4', '#10b981', '#8B1538', '#84cc16'][i],
      })));
    },
  },
  {
    method: 'GET',
    pattern: /\/api\/community\/posts/,
    handler: (url) => {
      const circleId = url.searchParams.get('circleId');
      return ok(Array.from({ length: 8 }, (_, i) => ({
        id: `post-${String(i).padStart(4, '0')}`, circleId: circleId || 'circle-0001',
        anonymousId: `anon-${String(i).padStart(6, '0')}`,
        content: `Community discussion post about health topics. Post #${i + 1}.`,
        timestamp: Date.now() - i * 3600000 * 4,
        reactions: [{ emoji: 'heart', count: 5 + i }, { emoji: 'support', count: 3 + i }],
        replyCount: i * 2, zkpVerified: i % 2 === 0, tags: ['support', 'experience'],
      })));
    },
  },
  {
    method: 'POST',
    pattern: /\/api\/community\/posts/,
    handler: () => ok({ id: `post-${Date.now()}`, circleId: 'circle-0001', anonymousId: `anon-${Date.now()}`, content: 'test', timestamp: Date.now(), reactions: [], replyCount: 0, zkpVerified: false, tags: [] }),
  },

  // ── Rewards ─────────────────────────────────────────────────────────────
  {
    method: 'GET',
    pattern: /\/api\/rewards\/history/,
    handler: () => ok(Array.from({ length: 10 }, (_, i) => ({
      id: `reward-${String(i).padStart(4, '0')}`,
      action: ['data_upload', 'wearable_sync', 'community_post', 'health_checkup', 'data_contribution', 'streak_bonus', 'milestone', 'referral', 'data_upload', 'wearable_sync'][i],
      description: `Earned reward for ${['uploading health record', 'syncing wearable', 'community post', 'health checkup', 'research contribution', 'streak bonus', 'milestone reached', 'referral bonus', 'uploading record', 'syncing data'][i]}`,
      amount: [5, 2, 1, 10, 25, 5, 50, 20, 5, 2][i], currency: 'AETHEL',
      earnedAt: Date.now() - i * 86400000,
      claimedAt: i < 7 ? Date.now() - i * 86400000 + 3600000 : undefined,
      txHash: i < 7 ? `0x${'e'.repeat(64)}` : undefined,
    }))),
  },
  {
    method: 'GET',
    pattern: /\/api\/rewards$/,
    handler: (url) => {
      const include = url.searchParams.get('include');
      if (include === 'streaks') return ok([
        { action: 'data_upload', currentStreak: 12, longestStreak: 18, lastActionAt: Date.now() - 3600000, nextMilestone: 14, multiplier: 1.5 },
        { action: 'wearable_sync', currentStreak: 28, longestStreak: 42, lastActionAt: Date.now() - 7200000, nextMilestone: 30, multiplier: 2.0 },
        { action: 'community_post', currentStreak: 5, longestStreak: 10, lastActionAt: Date.now() - 86400000, nextMilestone: 7, multiplier: 1.2 },
        { action: 'health_checkup', currentStreak: 3, longestStreak: 6, lastActionAt: Date.now() - 86400000 * 7, nextMilestone: 4, multiplier: 1.0 },
      ]);
      if (include === 'stats') return ok({ totalEarned: 1247, totalClaimed: 982, pendingRewards: 265, activeStreaks: 4, rank: 87, level: 5, nextLevelThreshold: 1500 });
      // Default: return reward entries array
      return ok(Array.from({ length: 5 }, (_, i) => ({
        id: `reward-${String(i).padStart(4, '0')}`,
        action: ['data_upload', 'wearable_sync', 'community_post', 'health_checkup', 'data_contribution'][i],
        description: `Earned reward ${i}`,
        amount: [5, 2, 1, 10, 25][i], currency: 'AETHEL',
        earnedAt: Date.now() - i * 86400000,
        claimedAt: i < 3 ? Date.now() - i * 86400000 + 3600000 : undefined,
      })));
    },
  },

  // ── Research ────────────────────────────────────────────────────────────
  {
    method: 'GET',
    pattern: /\/api\/research\/studies/,
    handler: (url) => {
      const include = url.searchParams.get('include');
      if (include === 'contributions') {
        return ok(Array.from({ length: 3 }, (_, i) => ({
          id: `contrib-${String(i).padStart(4, '0')}`,
          studyId: `study-${String(i).padStart(4, '0')}`,
          contributorAnonymousId: `anon-${String(i).padStart(6, '0')}`,
          dataTypes: ['lab_result', 'vitals'],
          contributedAt: Date.now() - i * 86400000 * 7,
          compensation: 50 + i * 25,
          consentId: `consent-${String(i).padStart(4, '0')}`,
          status: i === 0 ? 'accepted' : i === 1 ? 'pending' : 'rejected',
        })));
      }
      return ok(Array.from({ length: 4 }, (_, i) => ({
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
      })));
    },
  },

  // ── Research POST ──────────────────────────────────────────────────────
  {
    method: 'POST',
    pattern: /\/api\/research\/studies/,
    handler: () => ok({
      id: `study-enrolled-${Date.now()}`, title: 'Enrolled Study',
      description: 'Test enrollment', institution: 'Test Inst',
      principalInvestigator: ['Dr. Test'], status: 'active',
      participantCount: 51, targetParticipants: 200,
      dataTypesRequired: ['lab_result'], compensationShio: 50,
      irbApprovalId: 'IRB-TEST', startDate: Date.now(), endDate: Date.now() + 86400000,
      zkpRequired: false,
    }),
  },

  // ── Rewards POST ──────────────────────────────────────────────────────
  {
    method: 'POST',
    pattern: /\/api\/rewards$/,
    handler: () => ok({
      id: `reward-claimed-${Date.now()}`, action: 'data_upload',
      description: 'Claimed reward', amount: 5, currency: 'AETHEL',
      earnedAt: Date.now() - 86400000, claimedAt: Date.now(),
      txHash: `0x${'f'.repeat(64)}`,
    }),
  },

  // ── FHIR Export POST ──────────────────────────────────────────────────
  {
    method: 'POST',
    pattern: /\/api\/fhir\/export/,
    handler: () => ok({
      id: `export-${Date.now()}`, format: 'json',
      resourceTypes: ['Observation'], destination: 'ipfs',
      lastExportAt: Date.now(),
    }),
  },

  // ── TEE Attestation POST ─────────────────────────────────────────────
  {
    method: 'POST',
    pattern: /\/api\/tee\/attestations/,
    handler: () => ok({ verified: true, platform: 'Intel SGX' }),
  },

  // ── Digital Twin ────────────────────────────────────────────────────────
  {
    method: 'GET',
    pattern: /\/api\/twin\/simulations/,
    handler: () => ok(Array.from({ length: 3 }, (_, i) => ({
      id: `sim-${String(i).padStart(4, '0')}`, scenario: ['Medication Change', 'Diet Adjustment', 'Exercise Plan'][i],
      description: `Simulation of ${['medication change', 'diet adjustment', 'exercise plan'][i]} impact.`,
      status: ['completed', 'completed', 'running'][i],
      startedAt: Date.now() - (30 + i * 10) * 86400000,
      completedAt: i < 2 ? Date.now() - (29 + i * 10) * 86400000 : undefined,
      attestation: `0x${'a'.repeat(64)}`,
    }))),
  },
  {
    method: 'POST',
    pattern: /\/api\/twin\/simulations/,
    handler: () => ok({
      id: `sim-new-${Date.now()}`, scenario: 'Custom Simulation',
      description: 'User-initiated simulation.', status: 'running',
      startedAt: Date.now(), attestation: `0x${'a'.repeat(64)}`,
    }),
  },
  {
    method: 'GET',
    pattern: /\/api\/twin\/parameters/,
    handler: () => ok(Array.from({ length: 5 }, (_, i) => ({
      id: `param-${i}`, name: ['Weight', 'Height', 'BMI', 'Heart Rate', 'Sleep Hours'][i],
      category: ['physical', 'physical', 'physical', 'vitals', 'lifestyle'][i],
      currentValue: [70, 170, 24.2, 72, 7.5][i], unit: ['kg', 'cm', 'kg/m²', 'bpm', 'hours'][i],
      lastUpdated: Date.now() - i * 86400000,
    }))),
  },
  {
    method: 'GET',
    pattern: /\/api\/twin\/predictions/,
    handler: () => ok(Array.from({ length: 4 }, (_, i) => ({
      id: `pred-${i}`, biomarker: ['HbA1c', 'Cholesterol', 'TSH', 'Vitamin D'][i],
      currentValue: [5.4, 190, 2.1, 35][i], predictedValue: [5.3, 185, 2.0, 38][i],
      confidence: 92 - i * 2, timeframedays: 90, unit: ['%', 'mg/dL', 'mIU/L', 'ng/mL'][i],
    }))),
  },
  {
    method: 'GET',
    pattern: /\/api\/twin$/,
    handler: () => ok({
      id: 'twin-001', modelVersion: 'v3.2', dataSourceCount: 12,
      createdAt: Date.now() - 180 * 86400000, lastUpdated: Date.now() - 86400000,
      status: 'active', fidelityScore: 94.5,
      attestation: `0x${'b'.repeat(64)}`,
    }),
  },

  // ── Clinical Decision Support ─────────────────────────────────────────
  {
    method: 'GET',
    pattern: /\/api\/clinical\/pathways/,
    handler: () => ok(Array.from({ length: 3 }, (_, i) => ({
      id: `pathway-${i}`, name: ['Diabetes Management', 'Hypertension Protocol', 'Asthma Care'][i],
      status: 'active', steps: 5 + i, completedSteps: 3 + i, updatedAt: Date.now() - i * 86400000,
    }))),
  },
  {
    method: 'GET',
    pattern: /\/api\/clinical\/interactions/,
    handler: () => ok(Array.from({ length: 2 }, (_, i) => ({
      id: `interaction-${i}`, drugA: ['Metformin', 'Lisinopril'][i], drugB: ['Insulin', 'Amlodipine'][i],
      severity: ['moderate', 'mild'][i], description: `Drug interaction ${i}`, recommendation: `Monitor ${i}`,
    }))),
  },
  {
    method: 'GET',
    pattern: /\/api\/clinical\/differentials/,
    handler: () => ok(Array.from({ length: 3 }, (_, i) => ({
      id: `diff-${i}`, condition: ['Type 2 Diabetes', 'Hypothyroidism', 'Iron Deficiency'][i],
      probability: 0.85 - i * 0.15, supportingEvidence: ['Elevated HbA1c', 'Elevated TSH', 'Low ferritin'][i],
    }))),
  },
  {
    method: 'GET',
    pattern: /\/api\/clinical\/audit/,
    handler: () => ok(Array.from({ length: 5 }, (_, i) => ({
      id: `audit-${i}`, action: ['pathway_activated', 'alert_acknowledged', 'interaction_reviewed', 'differential_updated', 'pathway_completed'][i],
      timestamp: Date.now() - i * 86400000, actor: `Dr. Provider ${i}`, details: `Clinical audit entry ${i}`,
    }))),
  },
  {
    method: 'GET',
    pattern: /\/api\/clinical$/,
    handler: (url) => {
      const view = url.searchParams.get('view');
      if (view === 'alerts') {
        return ok(Array.from({ length: 4 }, (_, i) => ({
          id: `alert-${i}`, severity: ['critical', 'high', 'medium', 'low'][i],
          title: `Clinical Alert ${i}`, message: `Alert message ${i}`,
          acknowledged: i > 1, createdAt: Date.now() - i * 3600000,
        })));
      }
      // stats
      return ok({
        totalPathways: 3, activeAlerts: 2, resolvedAlerts: 8,
        interactionsChecked: 15, differentialsGenerated: 12,
        lastUpdated: Date.now(),
      });
    },
  },
  {
    method: 'POST',
    pattern: /\/api\/clinical$/,
    handler: () => ok(undefined),
  },

  // ── Compliance ────────────────────────────────────────────────────────
  {
    method: 'GET',
    pattern: /\/api\/compliance\/audit/,
    handler: (url) => {
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '20');
      const items = Array.from({ length: Math.min(limit, 10) }, (_, i) => ({
        id: `caudit-${(page - 1) * limit + i}`, action: ['check_passed', 'check_failed', 'report_generated', 'violation_detected', 'remediation_completed'][i % 5],
        framework: ['hipaa', 'gdpr', 'soc2', 'hipaa', 'gdpr'][i % 5],
        timestamp: Date.now() - i * 86400000, details: `Compliance audit entry ${i}`,
      }));
      return paginated(items, { page, limit, total: 50 });
    },
  },
  {
    method: 'GET',
    pattern: /\/api\/compliance\/reports/,
    handler: () => ok(Array.from({ length: 3 }, (_, i) => ({
      id: `report-${i}`, title: ['HIPAA Annual Report', 'GDPR Assessment', 'SOC2 Audit'][i],
      framework: ['hipaa', 'gdpr', 'soc2'][i], status: ['completed', 'completed', 'in_progress'][i],
      generatedAt: Date.now() - i * 30 * 86400000, score: 95 - i * 3,
    }))),
  },
  {
    method: 'POST',
    pattern: /\/api\/compliance\/reports/,
    handler: () => ok({
      id: `report-new-${Date.now()}`, title: 'Generated Report',
      framework: 'hipaa', status: 'in_progress', generatedAt: Date.now(), score: 0,
    }),
  },
  {
    method: 'GET',
    pattern: /\/api\/compliance\/checks/,
    handler: () => ok(Array.from({ length: 6 }, (_, i) => ({
      id: `check-${i}`, controlId: `CTL-${100 + i}`, name: `Control ${i}`,
      description: `Compliance check ${i}`, status: i < 4 ? 'passed' : i < 5 ? 'failed' : 'not_applicable',
      lastChecked: Date.now() - i * 86400000, framework: 'hipaa',
    }))),
  },
  {
    method: 'GET',
    pattern: /\/api\/compliance$/,
    handler: (url) => {
      const view = url.searchParams.get('view');
      if (view === 'frameworks') {
        return ok(Array.from({ length: 3 }, (_, i) => ({
          id: ['hipaa', 'gdpr', 'soc2'][i], name: ['HIPAA', 'GDPR', 'SOC 2'][i],
          complianceScore: 95 - i * 3, totalControls: 20 + i * 5,
          passingControls: 18 + i * 3, lastAssessment: Date.now() - i * 30 * 86400000,
        })));
      }
      if (view === 'violations') {
        return ok(Array.from({ length: 2 }, (_, i) => ({
          id: `violation-${i}`, framework: ['hipaa', 'gdpr'][i],
          severity: ['high', 'medium'][i], title: `Violation ${i}`,
          description: `Policy violation ${i}`, status: ['open', 'remediated'][i],
          detectedAt: Date.now() - i * 7 * 86400000,
        })));
      }
      // overview
      return ok({
        frameworks: [{ id: 'hipaa', name: 'HIPAA', score: 95 }, { id: 'gdpr', name: 'GDPR', score: 92 }],
        overallComplianceScore: 93, activeViolations: 1, daysSinceLastAudit: 12,
        upcomingAssessments: [{ framework: 'soc2', date: Date.now() + 30 * 86400000 }],
        complianceTrend: [{ month: 'Jan', score: 90 }, { month: 'Feb', score: 93 }],
      });
    },
  },

  // ── Emergency ─────────────────────────────────────────────────────────
  {
    method: 'GET',
    pattern: /\/api\/emergency\/care-team/,
    handler: () => ok(Array.from({ length: 4 }, (_, i) => ({
      id: `member-${i}`, name: ['Dr. Sarah Chen', 'Dr. James Liu', 'Nurse Kim Park', 'Dr. Emily Davis'][i],
      role: ['primary_physician', 'specialist', 'nurse', 'emergency_contact'][i],
      specialty: ['OB-GYN', 'Endocrinology', 'Women\'s Health', 'Emergency Medicine'][i],
      phone: `555-010${i}`, available: i < 3,
    }))),
  },
  {
    method: 'POST',
    pattern: /\/api\/emergency\/care-team/,
    handler: () => ok({ id: `member-new-${Date.now()}`, name: 'New Member', role: 'specialist', available: true }),
  },
  {
    method: 'GET',
    pattern: /\/api\/emergency\/protocols/,
    handler: () => ok(Array.from({ length: 3 }, (_, i) => ({
      id: `protocol-${i}`, name: ['Cardiac Emergency', 'Allergic Reaction', 'Stroke Protocol'][i],
      severity: ['critical', 'high', 'critical'][i], steps: 5 + i,
      lastUpdated: Date.now() - i * 30 * 86400000,
    }))),
  },
  {
    method: 'GET',
    pattern: /\/api\/emergency\/triage/,
    handler: () => ok(Array.from({ length: 3 }, (_, i) => ({
      id: `triage-${i}`, severity: ['urgent', 'semi-urgent', 'non-urgent'][i],
      symptoms: ['chest_pain', 'headache', 'fatigue'][i],
      recommendation: ['Seek immediate care', 'Schedule appointment', 'Monitor at home'][i],
      assessedAt: Date.now() - i * 7 * 86400000, confidence: 95 - i * 5,
    }))),
  },
  {
    method: 'POST',
    pattern: /\/api\/emergency\/triage/,
    handler: () => ok({
      id: `triage-new-${Date.now()}`, severity: 'semi-urgent',
      symptoms: 'test_symptom', recommendation: 'Schedule appointment',
      assessedAt: Date.now(), confidence: 88,
    }),
  },
  {
    method: 'GET',
    pattern: /\/api\/emergency\/handoffs/,
    handler: () => ok(Array.from({ length: 2 }, (_, i) => ({
      id: `handoff-${i}`, fromProvider: `Dr. Provider ${i}`, toProvider: `Dr. Provider ${i + 1}`,
      patientSummary: `Patient handoff summary ${i}`, status: ['completed', 'in_progress'][i],
      initiatedAt: Date.now() - i * 3 * 86400000,
    }))),
  },
  {
    method: 'POST',
    pattern: /\/api\/emergency\/handoffs/,
    handler: () => ok({
      id: `handoff-new-${Date.now()}`, fromProvider: 'Dr. A', toProvider: 'Dr. B',
      patientSummary: 'Summary', status: 'in_progress', initiatedAt: Date.now(),
    }),
  },
  {
    method: 'GET',
    pattern: /\/api\/emergency$/,
    handler: () => ok({
      id: 'ecard-001', bloodType: 'O+', allergies: ['Penicillin', 'Sulfa'],
      medications: ['Metformin 500mg', 'Lisinopril 10mg'],
      conditions: ['Type 2 Diabetes', 'Hypertension'],
      emergencyContacts: [{ name: 'Jane Doe', phone: '555-0100', relationship: 'Spouse' }],
      lastUpdated: Date.now() - 7 * 86400000,
    }),
  },

  // ── Genomics ──────────────────────────────────────────────────────────
  {
    method: 'GET',
    pattern: /\/api\/genomics\/biomarkers/,
    handler: (url) => {
      const marker = url.searchParams.get('marker');
      if (marker) {
        return ok({
          id: `bio-${marker}`, name: marker.toUpperCase(), category: 'metabolic',
          currentValue: 5.4, unit: '%', normalRange: { min: 4.0, max: 5.6 },
          trend: 'stable', lastMeasured: Date.now() - 7 * 86400000,
          history: [{ date: Date.now() - 30 * 86400000, value: 5.5 }, { date: Date.now() - 7 * 86400000, value: 5.4 }],
        });
      }
      return ok(Array.from({ length: 10 }, (_, i) => ({
        id: `bio-${i}`, name: ['HbA1c', 'Cholesterol', 'TSH', 'Vitamin D', 'Iron', 'B12', 'Folate', 'Cortisol', 'Estradiol', 'Progesterone'][i],
        category: ['metabolic', 'lipid', 'thyroid', 'vitamin', 'mineral', 'vitamin', 'vitamin', 'hormone', 'hormone', 'hormone'][i],
        currentValue: [5.4, 190, 2.1, 35, 80, 500, 15, 12, 150, 10][i],
        unit: ['%', 'mg/dL', 'mIU/L', 'ng/mL', 'ug/dL', 'pg/mL', 'ng/mL', 'ug/dL', 'pg/mL', 'ng/mL'][i],
        trend: ['stable', 'decreasing', 'stable', 'increasing', 'stable', 'stable', 'stable', 'stable', 'stable', 'stable'][i],
        lastMeasured: Date.now() - i * 7 * 86400000,
      })));
    },
  },
  {
    method: 'GET',
    pattern: /\/api\/genomics\/reports/,
    handler: () => ok(Array.from({ length: 3 }, (_, i) => ({
      id: `greport-${i}`, category: ['pharmacogenomics', 'risk_assessment', 'biomarkers'][i],
      title: ['Pharmacogenomics Report', 'Polygenic Risk Report', 'Biomarker Summary'][i],
      generatedAt: Date.now() - i * 30 * 86400000, status: 'completed',
    }))),
  },
  {
    method: 'POST',
    pattern: /\/api\/genomics\/reports/,
    handler: () => ok({
      id: `greport-new-${Date.now()}`, category: 'custom', title: 'Custom Report',
      generatedAt: Date.now(), status: 'generating',
    }),
  },
  {
    method: 'GET',
    pattern: /\/api\/genomics$/,
    handler: (url) => {
      const view = url.searchParams.get('view');
      if (view === 'pharmacogenomics') {
        return ok(Array.from({ length: 4 }, (_, i) => ({
          id: `pgx-${i}`, gene: ['CYP2D6', 'CYP2C19', 'CYP3A4', 'SLCO1B1'][i],
          phenotype: ['Normal Metabolizer', 'Rapid Metabolizer', 'Poor Metabolizer', 'Normal Function'][i],
          affectedDrugs: [['Codeine', 'Tramadol'], ['Clopidogrel', 'Omeprazole'], ['Simvastatin'], ['Atorvastatin']][i],
          recommendation: `Pharmacogenomic recommendation ${i}`,
        })));
      }
      if (view === 'risk-scores') {
        return ok(Array.from({ length: 3 }, (_, i) => ({
          id: `prs-${i}`, condition: ['Type 2 Diabetes', 'Coronary Artery Disease', 'Breast Cancer'][i],
          score: [0.35, 0.22, 0.12][i], percentile: [72, 55, 30][i],
          riskLevel: ['moderate', 'average', 'low'][i],
        })));
      }
      // overview
      return ok({
        totalVariants: 2500, clinicallyRelevant: 42,
        pharmacogenomicGenes: 4, riskScoresCalculated: 3,
        lastUpdated: Date.now() - 14 * 86400000,
      });
    },
  },

  // ── MPC ───────────────────────────────────────────────────────────────
  {
    method: 'GET',
    pattern: /\/api\/mpc\/sessions\/[^/]+$/,
    handler: (url) => {
      const id = url.pathname.split('/').pop();
      return ok({
        id, name: 'Session Detail', protocol: 'SPDZ', status: 'completed',
        participants: 3, createdAt: Date.now() - 7 * 86400000,
        convergence: Array.from({ length: 10 }, (_, i) => ({
          round: i + 1, loss: 1.0 - i * 0.08, accuracy: 0.5 + i * 0.045,
          timestamp: Date.now() - (10 - i) * 3600000,
        })),
      });
    },
  },
  {
    method: 'GET',
    pattern: /\/api\/mpc\/sessions/,
    handler: () => ok(Array.from({ length: 4 }, (_, i) => ({
      id: `mpc-session-${i}`, name: `MPC Session ${i}`, protocol: ['SPDZ', 'ABY3', 'SPDZ', 'ABY3'][i],
      status: ['completed', 'running', 'completed', 'pending'][i],
      participants: 3 + i, createdAt: Date.now() - i * 7 * 86400000,
    }))),
  },
  {
    method: 'POST',
    pattern: /\/api\/mpc\/sessions/,
    handler: () => ok({
      id: `mpc-session-new-${Date.now()}`, name: 'New Session', protocol: 'SPDZ',
      status: 'pending', participants: 3, createdAt: Date.now(),
    }),
  },
  {
    method: 'GET',
    pattern: /\/api\/mpc\/results/,
    handler: () => ok(Array.from({ length: 3 }, (_, i) => ({
      id: `mpc-result-${i}`, sessionId: `mpc-session-${i}`,
      accuracy: 0.92 + i * 0.02, completedAt: Date.now() - i * 7 * 86400000,
      outputHash: `0x${'c'.repeat(64)}`,
    }))),
  },
  {
    method: 'GET',
    pattern: /\/api\/mpc\/datasets/,
    handler: () => ok(Array.from({ length: 3 }, (_, i) => ({
      id: `mpc-dataset-${i}`, name: `Dataset ${i}`, recordCount: 1000 + i * 500,
      features: 10 + i * 3, encrypted: true, createdAt: Date.now() - i * 30 * 86400000,
    }))),
  },

  // ── Privacy Rights (GET) ──────────────────────────────────────────────
  {
    method: 'GET',
    pattern: /\/api\/privacy\//,
    handler: () => ok(Array.from({ length: 5 }, (_, i) => ({
      id: `req-${String(i).padStart(4, '0')}`,
      type: ['access', 'erasure', 'portability', 'access', 'erasure'][i],
      status: ['completed', 'processing', 'pending', 'completed', 'completed'][i],
      categories: ['lab_results', 'cycle_data'],
      requestedAt: Date.now() - i * 7 * 86400000,
      completedAt: i === 0 || i >= 3 ? Date.now() - (i * 7 - 1) * 86400000 : undefined,
    }))),
  },

  // ── Provider Reviews ──────────────────────────────────────────────────
  {
    method: 'GET',
    pattern: /\/api\/providers\/[^/]+$/,
    handler: () => ok(Array.from({ length: 3 }, (_, i) => ({
      id: `review-${i}`, rating: 5 - i as 1 | 2 | 3 | 4 | 5,
      categories: { quality: 5 - i, communication: 4, availability: 3 + i },
      comment: `Great provider ${i}`, createdAt: Date.now() - i * 30 * 86400000,
      verified: true,
    }))),
  },
  {
    method: 'POST',
    pattern: /\/api\/providers\/[^/]+$/,
    handler: () => ok({
      id: `review-new-${Date.now()}`, rating: 5,
      categories: { quality: 5, communication: 5, availability: 5 },
      comment: 'Excellent', createdAt: Date.now(), verified: false,
    }),
  },

  // ── Vault Fertility ───────────────────────────────────────────────────
  {
    method: 'GET',
    pattern: /\/api\/vault$/,
    handler: (url) => {
      if (url.searchParams.get('type') === 'fertility') {
        return ok(Array.from({ length: 4 }, (_, i) => ({
          id: `fertility-${i}`, name: ['LH Surge', 'Cervical Mucus', 'BBT Shift', 'Progesterone'][i],
          value: [25, 3, 0.5, 12][i], unit: ['mIU/mL', 'score', '°F', 'ng/mL'][i],
          date: Date.now() - i * 86400000, status: ['detected', 'fertile', 'confirmed', 'normal'][i],
        })));
      }
      if (url.searchParams.get('overview') === 'true') {
        return ok({
          compartments: 8, totalRecords: 342, storageUsed: 1.8 * 1024 * 1024 * 1024,
          privacyScore: { overall: 92, encryptionScore: 98, accessControlScore: 90, jurisdictionScore: 85, dataMinimizationScore: 88 },
        });
      }
      return ok({
        compartments: 8, totalRecords: 342, storageUsed: 1.8 * 1024 * 1024 * 1024,
        privacyScore: { overall: 92, encryptionScore: 98, accessControlScore: 90, jurisdictionScore: 85, dataMinimizationScore: 88 },
      });
    },
  },

  // ── Vault PATCH (lock/unlock compartment) ─────────────────────────────
  {
    method: 'PATCH',
    pattern: /\/api\/vault\/compartments/,
    handler: () => ok({
      id: 'vault-0001', category: 'cycle_tracking', label: 'Cycle Tracking',
      lockStatus: 'locked', recordCount: 45,
    }),
  },
  // ── Vault POST (log symptom) ──────────────────────────────────────────
  {
    method: 'POST',
    pattern: /\/api\/vault\/symptoms/,
    handler: () => ok({
      id: 'sym-new', date: Date.now(), category: 'pain', severity: 3, notes: 'Test symptom',
    }),
  },

  // ── Providers ───────────────────────────────────────────────────────────
  {
    method: 'GET',
    pattern: /\/api\/providers\/reputation/,
    handler: () => ok(Array.from({ length: 5 }, (_, i) => ({
      address: `aeth1provider${String(i).padStart(34, '0')}`,
      name: ['Dr. Sarah Chen', "Metro Women's Health", 'Dr. James Liu', 'Fertility Clinic', "Stanford Women's Care"][i],
      specialty: ['OB-GYN', 'Primary Care', 'Endocrinology', 'Reproductive Medicine', 'Gynecology'][i],
      trustLevel: ['gold', 'gold', 'silver', 'silver', 'bronze'][i],
      overallScore: 95 - i * 5, reviewCount: 20 + i * 5, totalAccesses: 100 + i * 30,
      onTimeRevocations: 98 - i, dataBreaches: 0, averageAccessDuration: 30 + i * 10,
      registeredAt: Date.now() - (365 + i * 90) * 86400000, lastActivityAt: Date.now() - i * 86400000 * 3,
    }))),
  },

  // ── XAI ─────────────────────────────────────────────────────────────────
  {
    method: 'GET',
    pattern: /\/api\/xai\/shap/,
    handler: (url) => {
      const modelId = url.searchParams.get('modelId');
      if (modelId) {
        // Feature importance for a specific model
        return ok([
          { feature: 'cycle_length', importance: 0.35, direction: 'positive' },
          { feature: 'temperature_shift', importance: 0.25, direction: 'positive' },
          { feature: 'sleep_quality', importance: 0.18, direction: 'positive' },
        ]);
      }
      // All explainability results
      return ok([
        {
          inferenceId: 'inf-001', modelId: 'lstm',
          shapValues: [
            { feature: 'cycle_length', value: 28, baseValue: 27.5, contribution: 0.35 },
            { feature: 'temperature_shift', value: 0.5, baseValue: 0.4, contribution: 0.25 },
          ],
          confidence: 96.2, explanation: 'The model predicts normal ovulation timing.',
        },
        {
          inferenceId: 'inf-002', modelId: 'anomaly',
          shapValues: [
            { feature: 'heart_rate_variability', value: 45, baseValue: 50, contribution: -0.3 },
          ],
          confidence: 93.8, explanation: 'No anomalies detected.',
        },
      ]);
    },
  },
  {
    method: 'GET',
    pattern: /\/api\/xai\/model-cards/,
    handler: () => ok([
      { modelId: 'lstm', name: 'Cycle LSTM', version: 'v2.1', description: 'Predicts menstrual cycle timing.', architecture: 'LSTM', trainingDataSize: 125000, validationAccuracy: 96.2 },
      { modelId: 'anomaly', name: 'Anomaly Detector', version: 'v1.4', description: 'Detects unusual health patterns.', architecture: 'Isolation Forest', trainingDataSize: 85000, validationAccuracy: 93.8 },
    ]),
  },
  {
    method: 'GET',
    pattern: /\/api\/xai\/bias/,
    handler: () => ok([
      { modelId: 'lstm', reportId: 'bias-001', overallFairness: 0.94 },
      { modelId: 'anomaly', reportId: 'bias-002', overallFairness: 0.91 },
    ]),
  },

  // ── Privacy ─────────────────────────────────────────────────────────────
  {
    method: 'POST',
    pattern: /\/api\/privacy\//,
    handler: () => ok({ id: `req-${Date.now()}`, type: 'access', status: 'processing', requestedAt: Date.now() }),
  },

  // ── Wallet Session ──────────────────────────────────────────────────────
  {
    method: 'GET',
    pattern: /\/api\/wallet\/connect$/,
    handler: () => ok({ address: 'aeth1mock', authenticated: true }),
  },
  {
    method: 'DELETE',
    pattern: /\/api\/wallet\/connect$/,
    handler: () => ok({ disconnected: true }),
  },

  // ── IPFS ────────────────────────────────────────────────────────────────
  {
    method: 'POST',
    pattern: /\/api\/ipfs\/upload/,
    handler: () => ok({ id: 'file-001', name: 'test-upload.pdf', cid: `Qm${'u'.repeat(44)}`, size: 1024 * 50, txHash: `0x${'f'.repeat(64)}`, encryptionKey: `0x${'a'.repeat(64)}`, encryption: 'AES-256-GCM', uploadedAt: Date.now() }),
  },
  {
    method: 'GET',
    pattern: /\/api\/ipfs\/upload/,
    handler: (url) => {
      if (url.searchParams.get('metrics')) return ok({ totalUsed: 2.4 * 1024 * 1024 * 1024, totalQuota: 10 * 1024 * 1024 * 1024, fileCount: 3 });
      return ok([
        { id: 'file-001', name: 'record-001.pdf', cid: `Qm${'a'.repeat(44)}`, size: 1024 * 50, encryption: 'AES-256-GCM', uploadedAt: Date.now() - 86400000 },
        { id: 'file-002', name: 'scan-002.dcm', cid: `Qm${'b'.repeat(44)}`, size: 1024 * 200, encryption: 'AES-256-GCM', uploadedAt: Date.now() - 172800000 },
      ]);
    },
  },
  {
    method: 'GET',
    pattern: /\/api\/ipfs\//,
    handler: () => ok({ cid: 'Qmtest', data: 'encrypted_data_placeholder', size: 1024 * 50, metadata: { encrypted: true, encryption: 'AES-256-GCM' } }),
  },

  // ── Missing mutation handlers (added for test coverage) ──────────────
  {
    method: 'DELETE',
    pattern: /\/api\/records\/[^/]+$/,
    handler: () => ok(undefined),
  },
  {
    method: 'POST',
    pattern: /\/api\/access$/,
    handler: () => ok({ id: `grant-${Date.now()}`, provider: 'Dr. New', providerName: 'Dr. New', status: 'Active', scope: 'Full Records', grantedAt: Date.now(), expiresAt: Date.now() + 90 * 86400000, txHash: `0x${'c'.repeat(64)}` }),
  },
  {
    method: 'PATCH',
    pattern: /\/api\/access\/[^/]+$/,
    handler: () => ok({ id: 'grant-0001', provider: 'Dr. Provider 0', status: 'Revoked', scope: 'Full Records', grantedAt: Date.now(), txHash: `0x${'c'.repeat(64)}` }),
  },
  {
    method: 'PATCH',
    pattern: /\/api\/consent\/[^/]+$/,
    handler: () => ok({ id: 'consent-0001', status: 'revoked', txHash: `0x${'d'.repeat(64)}` }),
  },
  {
    method: 'POST',
    pattern: /\/api\/marketplace$/,
    handler: () => ok({ id: `listing-${Date.now()}`, title: 'New Listing', category: 'menstrual_cycles', price: 25, currency: 'AETHEL', status: 'active', createdAt: Date.now() }),
  },
  {
    method: 'POST',
    pattern: /\/api\/marketplace\/[^/]+$/,
    handler: () => ok({ id: `purchase-${Date.now()}`, listingId: 'listing-0001', buyer: `aeth1${'b'.repeat(38)}`, price: 25, currency: 'AETHEL', purchasedAt: Date.now(), txHash: `0x${'d'.repeat(64)}`, status: 'completed' }),
  },
  {
    method: 'DELETE',
    pattern: /\/api\/marketplace\/[^/]+$/,
    handler: () => ok(undefined),
  },
  {
    method: 'POST',
    pattern: /\/api\/wearables\/[^/]+$/,
    handler: () => ok({ id: `dev-${Date.now()}`, provider: 'apple_health', deviceName: 'Apple Health', status: 'connected', lastSync: Date.now(), dataPointsSynced: 0, connectedAt: Date.now() }),
  },
  {
    method: 'POST',
    pattern: /\/api\/alerts\/rules/,
    handler: () => ok({ id: `rule-${Date.now()}`, metric: 'temperature', operator: 'gt', threshold: 100.4, severity: 'critical', enabled: true, channels: ['push'], createdAt: Date.now() }),
  },
  {
    method: 'PATCH',
    pattern: /\/api\/alerts\/rules\/[^/]+$/,
    handler: () => ok({ id: 'rule-0', metric: 'temperature', operator: 'gt', threshold: 100.4, severity: 'critical', enabled: true, channels: ['push'] }),
  },
  {
    method: 'POST',
    pattern: /\/api\/alerts\/[^/]+\/(acknowledge|resolve)/,
    handler: () => ok({ id: 'alert-0001', acknowledged: true, resolvedAt: Date.now() }),
  },
  {
    method: 'POST',
    pattern: /\/api\/staking$/,
    handler: () => ok({ id: `stake-${Date.now()}`, amount: 1000, stakedAt: Date.now(), status: 'staked', rewardsEarned: 0, rewardsClaimed: 0, votingPower: 1000, txHash: `0x${'b'.repeat(64)}` }),
  },
  {
    method: 'POST',
    pattern: /\/api\/staking\/[^/]+\/(unstake|withdraw)/,
    handler: () => ok({ id: 'stake-0001', status: 'unstaking', txHash: `0x${'b'.repeat(64)}` }),
  },
  {
    method: 'POST',
    pattern: /\/api\/staking\/rewards/,
    handler: () => ok({ claimed: true, txHash: `0x${'c'.repeat(64)}` }),
  },
  {
    method: 'POST',
    pattern: /\/api\/zkp\/claims/,
    handler: () => ok({ id: `claim-${Date.now()}`, claimType: 'age_range', description: 'Test claim', status: 'pending', createdAt: Date.now() }),
  },
  {
    method: 'POST',
    pattern: /\/api\/chat\/conversations/,
    handler: () => ok({ id: `conv-new-${Date.now()}`, title: 'New Conversation', createdAt: Date.now(), updatedAt: Date.now(), messageCount: 0, lastMessage: '', model: 'Health Transformer', totalTokens: 0, attestationCount: 0 }),
  },
  {
    method: 'POST',
    pattern: /\/api\/chat\/[^/]+$/,
    handler: () => ok({ id: `msg-${Date.now()}`, conversationId: 'conv-0001', role: 'assistant', content: 'AI response', timestamp: Date.now(), attestation: `0x${'a'.repeat(64)}`, model: 'Health Transformer', confidence: 95 }),
  },
  {
    method: 'DELETE',
    pattern: /\/api\/chat\/[^/]+$/,
    handler: () => ok(undefined),
  },
  {
    method: 'POST',
    pattern: /\/api\/community\/posts\/[^/]+\/react/,
    handler: () => ok({ reacted: true }),
  },
];

// ---------------------------------------------------------------------------
// Minimal Response-like object for jsdom (which lacks the web Response API)
// ---------------------------------------------------------------------------

function createMockResponse(body: object, status = 200) {
  const bodyStr = JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: {
      get: (name: string) => {
        if (name.toLowerCase() === 'content-type') return 'application/json';
        return null;
      },
    },
    json: async () => JSON.parse(bodyStr),
    text: async () => bodyStr,
    clone: function () { return createMockResponse(body, status); },
  };
}

// ---------------------------------------------------------------------------
// Install the fetch mock
// ---------------------------------------------------------------------------

const originalFetch = global.fetch;

function findHandler(method: string, url: URL): Handler | undefined {
  const pathname = url.pathname;
  for (const route of routes) {
    if (route.method === method && route.pattern.test(pathname)) {
      return route.handler;
    }
  }
  return undefined;
}

global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string'
    ? new URL(input, 'http://localhost')
    : input instanceof URL
      ? input
      : new URL((input as Request).url, 'http://localhost');

  const method = init?.method?.toUpperCase() || 'GET';
  const handler = findHandler(method, url);

  if (handler) {
    const body = handler(url, init);
    if (body) {
      return createMockResponse(body, 200);
    }
  }

  // Fallback: return a 404 response for unmatched routes
  return createMockResponse(
    { success: false, error: { code: 'NOT_FOUND', message: `No mock handler for ${method} ${url.pathname}` } },
    404,
  );
}) as jest.Mock;

// Reset between tests
afterEach(() => {
  (global.fetch as jest.Mock).mockClear();
});

// Restore original fetch after all tests
afterAll(() => {
  global.fetch = originalFetch;
});
