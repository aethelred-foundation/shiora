# Shiora — Release Process & Provenance

Adopted 2026-07-11 in response to external consultant review. Goal: **every
release is cut from one exact, independently reviewable commit, with claims
that match the artifact.** No release ships from a long-lived feature branch.

## Source of truth

- `main` is the authoritative, protected branch. Feature branches merge into it
  through pull requests with the full gate green; direct pushes to `main` and
  production deploys from any other ref are prohibited.
- Branch protection (required status checks, no force-push, PR review) is an
  organization-admin setting and must be enabled on `main` — tracked as an
  operator action, not enforceable from inside the repository.

## Release-candidate gate

An RC is an exact commit SHA on `main` that has passed, in CI:

1. `npm run type-check` && `npm run lint` — clean.
2. `npm run test:coverage` — full suite at the 100% threshold.
3. `npm run test:e2e` — Playwright suite green.
4. `npm run build` — production build green.
5. **Secret scan** — `gitleaks git` over history with [.gitleaks.toml](../.gitleaks.toml);
   zero unallowlisted findings.
6. **Production config lint** — the boot preflight checks run statically against
   the release configuration (no in-memory datastore, no dev keys/secrets, HSTS
   on, no wallet-header bypass, no wildcard origins, no mainnet chain target).
7. **SBOM** — `npm sbom --sbom-format cyclonedx` emitted and attached to the release.
8. Container image built from the RC SHA, digest recorded; image signing
   (cosign) once registry/key infrastructure is provisioned.

## Provenance manifest

The running application self-reports its provenance at `GET /api/system/release`:
application version, git SHA, build timestamp, database migration version,
OpenAPI-contract hash, maturity-registry hash, and the configured chain ID (if
any). Auditors compare this manifest against the release record; a mismatch is
an incident.

## History-hygiene scan (executed 2026-07-11)

`gitleaks` v8.30.1 over the **full git history** (151 commits, 6.6 MB) and the
tracked working tree. Findings and disposition:

| Finding | Location | Disposition |
|---|---|---|
| 4 × EC private keys | `src/lib/attestation/__testpki__/{ark,ask,vcek,rogue}.key` | **Intentional test fixtures** — generated ECDSA-P384 test PKI for the attestation-verifier suite; no production trust. Allowlisted in `.gitleaks.toml`. |
| Generic-api-key (docs) | `docs/DEPLOYMENT.md` (historical revision) | `<jwt-signing-secret>` **documentation placeholder** in a superseded revision; the current guide has no JWT variables. |
| 2 × generic-api-key | `src/app/api/compliance/audit/route.ts` (April-era revision) | **Synthetic identifiers** (`auth-9d3e…`, `consent-7d1e…`) from the removed mock layer; not credentials; absent from the current tree. |

**Conclusion: no real secret, credential, private production key, or PHI exists
anywhere in the repository history.** The legacy synthetic state file
(`.shiora-data/state.json`, fabricated provider/transaction/attestation values
from the pre-encryption era) was removed from tracking and gitignored on
2026-07-11; no code has read it since the mock store was deleted in June.
Because the historical revisions contain only synthetic values, history
rewriting is not required.

## Claims reconciliation (executed 2026-07-11)

- `README.md` rewritten: removed "13 smart contracts deployed", fabricated
  performance figures ("TEE Attestation Verify 320 ms"), the "HIPAA + GDPR"
  badge, and all TEE/on-chain/IPFS capability claims not present in the
  maturity registry. The README now states the pre-production posture and
  defers to `GET /api/system/status`.
- `docs/DEPLOYMENT.md` rewritten: removed nonexistent `JWT_*`, `TEE_*`, and
  public RPC/IPFS variables; now documents the real environment set and the
  enforced production boot gates.
- `.env.example` / `next.config.js`: removed the dead `NEXT_PUBLIC_RPC_URL`
  default that pointed at an Aethelred **mainnet** endpoint. Shiora must not
  carry a mainnet dependency until the Aethelred mainnet gate (external audit)
  has cleared; anchoring remains optional, asynchronous, and fail-soft.
- Any public mirror of this repository must be updated to this state or
  archived with a prominent "legacy — not representative" notice (operator
  action).

## Versioning

`package.json` version is bumped on `main` per release (semver; pre-1.0 minor =
feature, patch = fix). Tag `v<version>` on the RC SHA at release time.
