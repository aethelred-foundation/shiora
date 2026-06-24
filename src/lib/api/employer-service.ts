// ============================================================
// Shiora on Aethelred — Employer Service
//
// Organization and membership management for the employer-admin audience. An
// employer admin owns organizations (owner-scoped) and manages their members
// (scoped to the organization). Both collections are encrypted at rest and
// audited via the generic EncryptedDocumentRepository.
// ============================================================

import { randomUUID } from 'node:crypto';

import { getAuditLog } from '@/lib/api/audit-log';
import { EncryptedDocumentRepository } from '@/lib/persistence/encrypted-documents';
import { InMemoryDocumentStore, type DocumentStorePort } from '@/lib/persistence/document-store';
import { PgDocumentStore } from '@/lib/persistence/pg-document-store';
import { getPgClient } from '@/lib/persistence/sql-client';

export interface Organization {
  id: string;
  name: string;
  industry?: string;
  ownerAddress: string;
  createdAt: number;
}

export type MembershipStatus = 'active' | 'removed';

export interface OrgMembership {
  /** Document id — the member's wallet address (one membership per address). */
  id: string;
  orgId: string;
  address: string;
  role: string;
  status: MembershipStatus;
  joinedAt: number;
}

const ORG_COLLECTION = 'organization';
const MEMBER_COLLECTION = 'org-membership';

let orgRepository: EncryptedDocumentRepository<Organization> | null = null;
let memberRepository: EncryptedDocumentRepository<OrgMembership> | null = null;

function createStore(): DocumentStorePort {
  if (process.env.DATABASE_URL) {
    return new PgDocumentStore(getPgClient());
  }
  return new InMemoryDocumentStore();
}

function orgs(): EncryptedDocumentRepository<Organization> {
  if (!orgRepository) {
    orgRepository = new EncryptedDocumentRepository<Organization>(
      createStore(),
      getAuditLog(),
      ORG_COLLECTION,
      { create: 'ORG_CREATE', update: 'ORG_UPDATE' },
    );
  }
  return orgRepository;
}

function members(): EncryptedDocumentRepository<OrgMembership> {
  if (!memberRepository) {
    memberRepository = new EncryptedDocumentRepository<OrgMembership>(
      createStore(),
      getAuditLog(),
      MEMBER_COLLECTION,
      { create: 'ORG_MEMBER_ADD', update: 'ORG_MEMBER_REMOVE' },
    );
  }
  return memberRepository;
}

// -- organizations ---------------------------------------------------------

export function createOrganization(
  ownerAddress: string,
  input: { name: string; industry?: string },
): Promise<Organization> {
  return orgs().create(ownerAddress, {
    id: `org-${randomUUID().replace(/-/g, '')}`,
    name: input.name,
    ...(input.industry ? { industry: input.industry } : {}),
    ownerAddress,
    createdAt: Date.now(),
  });
}

export function listOrganizations(ownerAddress: string): Promise<Organization[]> {
  return orgs().list(ownerAddress);
}

/** Owner-scoped: returns the organization only if `ownerAddress` owns it. */
export function getOrganization(
  ownerAddress: string,
  orgId: string,
): Promise<Organization | undefined> {
  return orgs().get(ownerAddress, orgId);
}

// -- members ---------------------------------------------------------------

export function addMember(
  orgId: string,
  input: { address: string; role: string },
): Promise<OrgMembership> {
  return members().create(orgId, {
    id: input.address,
    orgId,
    address: input.address,
    role: input.role,
    status: 'active',
    joinedAt: Date.now(),
  });
}

export async function listMembers(orgId: string): Promise<OrgMembership[]> {
  const all = await members().list(orgId);
  return all.filter((member) => member.status === 'active');
}

export async function removeMember(
  orgId: string,
  address: string,
): Promise<OrgMembership | undefined> {
  const existing = await members().get(orgId, address);
  if (!existing || existing.status === 'removed') {
    return undefined;
  }
  return members().update(orgId, address, { status: 'removed' });
}

/** Test-only: reset the singletons so each test starts from empty state. */
export function __resetEmployerForTests(): void {
  orgRepository = null;
  memberRepository = null;
}
