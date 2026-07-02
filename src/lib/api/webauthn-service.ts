// ============================================================
// Shiora on Aethelred — WebAuthn ceremony service (GAP-12)
//
// Ties the verification core to storage: registered credentials live in an
// owner-scoped encrypted collection, and per-ceremony challenges are held
// briefly in memory keyed by owner (a passkey ceremony is a two-request
// round-trip within one authenticated session). The relying-party id/origin
// come from configuration.
//
// HONEST SCOPE: the challenge cache is per-instance. A multi-replica deployment
// behind a load balancer needs sticky sessions or a shared challenge store —
// noted as the production step; the verification itself is fully enforced.
// ============================================================

import { EncryptedDocumentRepository } from '@/lib/persistence/encrypted-documents';
import { InMemoryDocumentStore, type DocumentStorePort } from '@/lib/persistence/document-store';
import { PgDocumentStore } from '@/lib/persistence/pg-document-store';
import { getPgClient } from '@/lib/persistence/sql-client';
import { shouldUsePostgres } from '@/lib/persistence/datastore-mode';
import { getAuditLog } from '@/lib/api/audit-log';
import { serverEnv } from '@/lib/api/env';
import {
  generateWebAuthnChallenge,
  verifyRegistration,
  verifyAuthentication,
} from '@/lib/api/webauthn';

const COLLECTION = 'webauthn-credential';
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

export interface StoredCredential {
  id: string; // the credentialId (base64url); also the document id
  publicKeySpki: string;
  signCount: number;
  createdAt: number;
}

export type CredentialView = Pick<StoredCredential, 'id' | 'createdAt'>;

/** RP origin + id from config (first allowed origin). */
export function relyingParty(): { origin: string; rpId: string } {
  const origin = serverEnv.allowedOrigins[0];
  return { origin, rpId: new URL(origin).hostname };
}

let repository: EncryptedDocumentRepository<StoredCredential> | null = null;

function createStore(): DocumentStorePort {
  return shouldUsePostgres() ? new PgDocumentStore(getPgClient()) : new InMemoryDocumentStore();
}

function repo(): EncryptedDocumentRepository<StoredCredential> {
  if (!repository) {
    repository = new EncryptedDocumentRepository<StoredCredential>(
      createStore(), getAuditLog(), COLLECTION,
      { create: 'MFA_ENROLL', update: 'MFA_ENABLE' },
    );
  }
  return repository;
}

// Per-owner pending challenge (registration or authentication).
const challenges = new Map<string, { challenge: string; expiresAt: number }>();

function putChallenge(owner: string): string {
  const challenge = generateWebAuthnChallenge();
  challenges.set(owner, { challenge, expiresAt: Date.now() + CHALLENGE_TTL_MS });
  return challenge;
}

function takeChallenge(owner: string): string | null {
  const entry = challenges.get(owner);
  challenges.delete(owner); // single-use
  if (!entry || entry.expiresAt <= Date.now()) {
    return null;
  }
  return entry.challenge;
}

// ── Registration ────────────────────────────────────────────────────────────

export interface RegistrationOptions {
  challenge: string;
  rp: { id: string; name: string };
  user: { id: string; name: string };
  pubKeyCredParams: { type: 'public-key'; alg: number }[];
  timeout: number;
}

export function startRegistration(owner: string): RegistrationOptions {
  const challenge = putChallenge(owner);
  const { rpId } = relyingParty();
  return {
    challenge,
    rp: { id: rpId, name: 'Shiora on Aethelred' },
    user: { id: Buffer.from(owner).toString('base64url'), name: owner },
    pubKeyCredParams: [{ type: 'public-key', alg: -7 }], // ES256
    timeout: CHALLENGE_TTL_MS,
  };
}

export async function finishRegistration(
  owner: string,
  response: { attestationObject: string; clientDataJSON: string },
): Promise<CredentialView> {
  const challenge = takeChallenge(owner);
  if (!challenge) {
    throw new Error('No pending registration challenge (expired or missing).');
  }
  const { origin, rpId } = relyingParty();
  const verified = verifyRegistration({
    attestationObject: response.attestationObject,
    clientDataJSON: response.clientDataJSON,
    expectedChallenge: challenge,
    expectedOrigin: origin,
    expectedRpId: rpId,
  });
  const credential: StoredCredential = {
    id: verified.credentialId,
    publicKeySpki: verified.publicKeySpki,
    signCount: verified.signCount,
    createdAt: Date.now(),
  };
  await repo().create(owner, credential);
  return { id: credential.id, createdAt: credential.createdAt };
}

// ── Authentication ───────────────────────────────────────────────────────────

export interface AuthenticationOptions {
  challenge: string;
  rpId: string;
  allowCredentials: { type: 'public-key'; id: string }[];
  timeout: number;
}

export async function startAuthentication(owner: string): Promise<AuthenticationOptions> {
  const challenge = putChallenge(owner);
  const { rpId } = relyingParty();
  const credentials = await repo().list(owner);
  return {
    challenge,
    rpId,
    allowCredentials: credentials.map((c) => ({ type: 'public-key', id: c.id })),
    timeout: CHALLENGE_TTL_MS,
  };
}

export async function finishAuthentication(
  owner: string,
  response: { credentialId: string; authenticatorData: string; clientDataJSON: string; signature: string },
): Promise<{ verified: true }> {
  const challenge = takeChallenge(owner);
  if (!challenge) {
    throw new Error('No pending authentication challenge (expired or missing).');
  }
  const credential = await repo().get(owner, response.credentialId);
  if (!credential) {
    throw new Error('Unknown credential.');
  }
  const { origin, rpId } = relyingParty();
  const result = verifyAuthentication({
    publicKeySpki: credential.publicKeySpki,
    authenticatorData: response.authenticatorData,
    clientDataJSON: response.clientDataJSON,
    signature: response.signature,
    expectedChallenge: challenge,
    expectedOrigin: origin,
    expectedRpId: rpId,
    storedSignCount: credential.signCount,
  });
  await repo().update(owner, credential.id, { signCount: result.newSignCount });
  return { verified: true };
}

export async function listCredentials(owner: string): Promise<CredentialView[]> {
  return (await repo().list(owner)).map((c) => ({ id: c.id, createdAt: c.createdAt }));
}

export async function deleteCredential(owner: string, id: string): Promise<boolean> {
  return repo().softDelete(owner, id);
}

export function __resetWebAuthnForTests(): void {
  repository = null;
  challenges.clear();
}
