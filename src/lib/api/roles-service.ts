// ============================================================
// Shiora on Aethelred — Roles Service
//
// Encrypted, audited persistence of per-address role assignments. Backs the
// RBAC layer: each address has a single assignment document listing its roles.
// Addresses with no assignment default to ['individual']. Postgres when
// DATABASE_URL is set, otherwise in-memory — both via the generic
// EncryptedDocumentRepository.
// ============================================================

import { getAuditLog } from '@/lib/api/audit-log';
import { EncryptedDocumentRepository } from '@/lib/persistence/encrypted-documents';
import { InMemoryDocumentStore, type DocumentStorePort } from '@/lib/persistence/document-store';
import { PgDocumentStore } from '@/lib/persistence/pg-document-store';
import { getPgClient } from '@/lib/persistence/sql-client';
import { DEFAULT_ROLES, type Role } from './roles';

export interface RoleAssignment {
  /** Document id — equal to the address (one assignment per address). */
  id: string;
  address: string;
  roles: Role[];
  updatedAt: number;
}

const COLLECTION = 'role-assignment';

let repository: EncryptedDocumentRepository<RoleAssignment> | null = null;

function createStore(): DocumentStorePort {
  if (process.env.DATABASE_URL) {
    return new PgDocumentStore(getPgClient());
  }
  return new InMemoryDocumentStore();
}

function repo(): EncryptedDocumentRepository<RoleAssignment> {
  if (!repository) {
    repository = new EncryptedDocumentRepository<RoleAssignment>(
      createStore(),
      getAuditLog(),
      COLLECTION,
      { create: 'ROLE_ASSIGN', update: 'ROLE_ASSIGN' },
    );
  }
  return repository;
}

function unique(roles: Role[]): Role[] {
  return Array.from(new Set(roles));
}

/** The stored assignment for an address, if any. */
export function getAssignment(address: string): Promise<RoleAssignment | undefined> {
  return repo().get(address, address);
}

/** The effective roles for an address (defaults to ['individual']). */
export async function getRoles(address: string): Promise<Role[]> {
  const assignment = await getAssignment(address);
  return assignment ? assignment.roles : [...DEFAULT_ROLES];
}

export async function hasRole(address: string, role: Role): Promise<boolean> {
  return (await getRoles(address)).includes(role);
}

/** Grant a role to an address, creating the assignment if needed. */
export async function assignRole(address: string, role: Role): Promise<RoleAssignment> {
  const existing = await getAssignment(address);
  const now = Date.now();
  if (!existing) {
    return repo().create(address, {
      id: address,
      address,
      roles: unique([...DEFAULT_ROLES, role]),
      updatedAt: now,
    });
  }
  const roles = unique([...existing.roles, role]);
  await repo().update(address, address, { roles, updatedAt: now });
  return { ...existing, roles, updatedAt: now };
}

/** Remove a role from an address. Returns the updated assignment, or undefined
 *  when the address had no assignment to modify. */
export async function revokeRole(address: string, role: Role): Promise<RoleAssignment | undefined> {
  const existing = await getAssignment(address);
  if (!existing) {
    return undefined;
  }
  return repo().update(address, address, {
    roles: existing.roles.filter((entry) => entry !== role),
    updatedAt: Date.now(),
  });
}

/** Test-only: reset the singleton so each test starts from empty state. */
export function __resetRolesForTests(): void {
  repository = null;
}
