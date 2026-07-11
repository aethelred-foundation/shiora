// ============================================================
// Shiora on Aethelred — WebAuthn ceremony service (GAP-12)
//
// Ties the verification core to storage: registered credentials live in an
// owner-scoped encrypted collection, and per-ceremony challenges live in the
// shared challenge store (Postgres under DATABASE_URL) — single-use, TTL'd,
// and consumable on a different replica than the one that minted them, so a
// restart or failover mid-ceremony cannot break or weaken the flow. The
// relying-party id/origin come from configuration.
// ============================================================

import { EncryptedDocumentRepository } from '@/lib/persistence/encrypted-documents';
import { InMemoryDocumentStore, type DocumentStorePort } from '@/lib/persistence/document-store';
import { PgDocumentStore } from '@/lib/persistence/pg-document-store';
import { getPgClient } from '@/lib/persistence/sql-client';
import { shouldUsePostgres } from '@/lib/persistence/datastore-mode';
import { getChallengeStore, __resetChallengeStoreForTests, type CeremonyKind } from '@/lib/persistence/challenge-store';
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

// Pending challenges live in the shared store: one single-use slot per
// (owner, ceremony), replaced when a new ceremony starts.
async function putChallenge(owner: string, ceremony: CeremonyKind): Promise<string> {
  const challenge = generateWebAuthnChallenge();
  await getChallengeStore().put(owner, ceremony, challenge, Date.now() + CHALLENGE_TTL_MS);
  return challenge;
}

function takeChallenge(owner: string, ceremony: CeremonyKind): Promise<string | null> {
  return getChallengeStore().take(owner, ceremony);
}

// ── Registration ────────────────────────────────────────────────────────────

export interface RegistrationOptions {
  challenge: string;
  rp: { id: string; name: string };
  user: { id: string; name: string };
  pubKeyCredParams: { type: 'public-key'; alg: number }[];
  timeout: number;
}

export async function startRegistration(owner: string): Promise<RegistrationOptions> {
  const challenge = await putChallenge(owner, 'registration');
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
  const challenge = await takeChallenge(owner, 'registration');
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
  const challenge = await putChallenge(owner, 'authentication');
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
  const challenge = await takeChallenge(owner, 'authentication');
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
  __resetChallengeStoreForTests();
}
