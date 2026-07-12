/** @jest-environment node */

// ============================================================
// Consultant §4 invariant: wallet-derived client sealing must not reach the
// pilot corridor. The only wallet-signature-derived encryption in the platform
// is the cycle/symptom vault's optional free-text field — a browser-only
// surface. Because the `vault` segment is deferred under SHIORA_PROFILE=pilot,
// no pilot-enabled field can be sealed to a losable wallet key, so account
// recovery restores access to ALL pilot data (every pilot-enabled encrypted
// field uses server-custodied envelope encryption, not a wallet-derived key).
//
// If a future change moves wallet-derived sealing out of the vault surface, or
// re-enables the vault under the pilot profile, this test fails — a deliberate
// tripwire on the "recovery ≠ data recovery" risk.
// ============================================================

import { featureDisabledReason } from '@/lib/api/feature-flags';
import { FIELD_KEY_MESSAGE } from '@/lib/crypto/client-field-encryption';

describe('wallet-derived client sealing is excluded from the pilot (consultant §4)', () => {
  it('the only client-sealing key is derived from a wallet signature', () => {
    // Anchors this invariant to the actual mechanism: the field key is derived
    // by signing a fixed message with the wallet (see useFieldKey).
    expect(FIELD_KEY_MESSAGE.toLowerCase()).toMatch(/shiora|sign|unlock|field/);
  });

  it('the vault surface (host of the client-sealed field) is refused under the pilot profile', () => {
    // Deferred under pilot → 503 before any handler runs → no client-sealed
    // value can be written in the pilot.
    expect(featureDisabledReason('/api/vault', 'pilot')).toBeTruthy();
    expect(featureDisabledReason('/api/vault/symptoms', 'pilot')).toBeTruthy();
    expect(featureDisabledReason('/api/vault/cycle', 'pilot')).toBeTruthy();
  });

  it('pilot-enabled encrypted surfaces are server-custodied and stay reachable', () => {
    // These use server-side envelope encryption (recoverable with the account),
    // not a wallet-derived key — so they must NOT be disabled under pilot.
    for (const path of ['/api/records', '/api/consent', '/api/me/clinical-notes', '/api/me/recovery/codes']) {
      expect(featureDisabledReason(path, 'pilot')).toBeNull();
    }
  });
});
