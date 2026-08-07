# Shiora × MBZUAI IEC — Partnership Proposal

**Prepared for:** MBZUAI — Incubation &
Entrepreneurship Center (IEC).
**Prepared by:** Ramesh Tamilselvan, founder, Shiora.
**Date:** 2026-06-24.
**Status:** proposal for discussion. Commercial terms below are deliberately left as **open
items to negotiate**.

---

## 1. The opportunity

Shiora is a privacy-first digital health platform built on a real, encrypted, audited data
core, designed to serve six distinct audiences from a single architecture:

- **Individuals** — own and control their health records, consent, and data sharing.
- **Providers** — access only the patient data explicitly shared with them.
- **Employers** — administer organization and membership programs.
- **Governments** — de-identified, k-anonymised population analytics.
- **Health plans** — population insight and (roadmap) interoperability.
- **Researchers** — a consented data marketplace and (roadmap) privacy-preserving compute.

The proposal: **Shiora supplies the technology and platform; an MBZUAI-IEC-incubated venture
builds the commercial business around it.** Shiora provides and continues to develop the
engineering; the venture owns commercialization — customers, go-to-market, operations, and
fundraising — with IEC's access to talent, capital, and the UAE health ecosystem.

This document gives the IEC and the prospective venture team an honest, technically grounded
view of exactly what exists today, what is on the roadmap, and what it takes to run it in
production.

---

## 2. Partnership model

| Shiora provides                                                                                               | The IEC venture owns                                                         |
| ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| The platform: encrypted PHI data core, RBAC, audit, GDPR rights, analytics, marketplace, employer admin, MFA. | Commercialization: customers, pricing, contracts, go-to-market.              |
| Ongoing engineering and the integration roadmap (TEE, ZK, MPC, chain, IPFS, managed inference).               | Business operations, support, and the customer relationship.                 |
| Architecture, security posture, and technical documentation.                                                  | Production operations on the venture's chosen cloud (with Shiora's support). |
| Technical support and knowledge transfer to the venture team.                                                 | Fundraising and regulatory/clinical engagement in-market.                    |

The venture is expected to be led by a founder/team **referred by the IEC and selected by
Shiora after a direct interaction** — consistent with the discussion held with the IEC program
lead. Shiora views this as the first of a broader set of collaborations with MBZUAI.

---

## 3. What is real today (the credibility anchor)

We hold a strict engineering bar and report status honestly. The **PHI-bearing core is
production-grade and verifiable**, not a demo:

- **Encryption:** AES-256-GCM envelope encryption — per-record data keys wrapped by a key
  encryption key, with authenticated-additional-data binding. No PHI reaches storage in
  plaintext. Key rotation is versioned through a `KeyProvider` seam ready for a KMS adapter.
- **Tamper-evident audit:** every mutation is recorded in a SHA-256 hash-chained, persisted
  audit log with concurrency-safe append and chain verification — verified against a real
  Postgres engine.
- **Access control:** six-audience role model with a capability matrix enforced on every route
  that touches PHI or analytics. Providers see only what patients have shared.
- **Privacy rights:** GDPR access, portability, and erasure operate over real stored data.
- **Population analytics:** de-identified cohort analytics with k-anonymity suppression.
- **Platform safety:** MFA (TOTP), a Postgres-backed distributed rate limiter, versioned
  migrations, signed `__Host-` session cookies, a strict security-header policy, and a
  **production preflight that refuses to serve PHI from a non-durable store**.
- **Quality bar:** a **100% test-coverage gate** (303 suites / 4,796 tests), clean lint and
  type-check, and **zero production dependency vulnerabilities** across the application and
  contract runtime trees.

**Radical transparency about what is _not_ yet real.** Capabilities that depend on an external
system we have not yet wired — trusted execution environments (TEE), zero-knowledge proofs,
secure multi-party computation, on-chain anchoring, IPFS storage, and the SANA health assistant —
are clearly marked **simulated**. Their API responses carry an explicit simulation label, and
the full, machine-readable breakdown is served at `GET /api/system/status`. Nothing simulated
is presented as a verified, on-chain, or clinical result. We believe this transparency is
exactly what a research university and its partners should expect.

---

## 4. Architecture & risk overview

**Shape.** A Next.js application with a typed API layer over a ports-and-adapters data core:

```
Client  →  API routes (RBAC + rate limit + validation)  →  Services
                                                              │
                              Encrypted repositories (envelope crypto + audit)
                                                              │
                         RecordStore / DocumentStore / AuditStore ports
                                                              │
                          In-memory (dev)        Postgres (production)
```

- PHI is encrypted at the repository boundary; storage adapters only ever see ciphertext.
- The audit chain is independent of the data stores and is the integrity backbone.
- Driver selection is centralized: in production, the absence of a durable datastore is a
  hard failure, not a silent in-memory fallback.

**Principal risks and how they are managed.**

| Risk                         | Current control                                           | Residual action                                |
| ---------------------------- | --------------------------------------------------------- | ---------------------------------------------- |
| PHI exposure at rest         | Envelope encryption, AAD binding, no plaintext to storage | Move the KEK to a KMS/HSM.                     |
| Key compromise               | Versioned keys, rotation seam                             | KMS-managed keys + emergency-rotation runbook. |
| Unauthorized access          | RBAC + capability checks, signed sessions, MFA            | Step-up MFA on the most sensitive routes.      |
| Tampering                    | Hash-chained audit + verification                         | WORM/object-lock retention sink.               |
| Misrepresenting maturity     | Simulation labels + `/api/system/status`                  | Replace simulated subsystems per the roadmap.  |
| Data durability              | Postgres adapters + preflight guard                       | Managed HA Postgres, backups, restore drills.  |
| Regulatory (HIPAA/GDPR/SaMD) | Technical safeguards implemented                          | Formal RA, DPIA, BAAs, and a SaMD opinion.     |

A full, line-item status across twelve domains is in `docs/PRODUCTION_READINESS.md`.

---

## 5. Integration roadmap (realistic timelines)

Timelines are engineering estimates from a frozen baseline, assuming the venture provisions the
required infrastructure and third-party access in parallel.

| Phase                                 | Focus                                                                                                                      | Indicative window |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| **0 — Hardening & deploy**            | Managed Postgres HA, KMS-backed keys, TLS/WAF, CI/CD, monitoring; cut `v1.0.0-mbzuai`.                                     | Weeks 1–4         |
| **1 — Compliance process (parallel)** | HIPAA RA, BAAs/DPA, DPIA, SaMD opinion, SOC 2 scoping, external pen test.                                                  | Months 1–6        |
| **2 — First real integration**        | Real object storage (IPFS or S3/GCS with object-lock) replacing simulated CIDs; WORM audit sink.                           | Months 2–3        |
| **3 — Health assistant (SANA)**       | Managed inference gateway with safety guardrails, request/response logging, de-identified inputs; no autonomous diagnosis. | Months 3–5        |
| **4 — Verifiable compute**            | Real ZK prover and/or MPC engine for the consented-research paths.                                                         | Months 5–8        |
| **5 — On-chain & TEE**                | L1 client for audit anchoring/consent; real TEE attestation where it adds assurance.                                       | Months 6–10       |

Each roadmap item flips its capability from **simulated** to **production** in
`/api/system/status` only when it is genuinely wired — never before.

---

## 6. Production deployment responsibilities

| Workstream                                                        | Lead                        | Notes                                           |
| ----------------------------------------------------------------- | --------------------------- | ----------------------------------------------- |
| Cloud infrastructure (HA Postgres, KMS, WAF, logging, monitoring) | IEC venture (Infra)         | Shiora supports architecture and configuration. |
| Application engineering + roadmap integrations                    | Shiora (Eng)                | Ongoing.                                        |
| Compliance & legal (HIPAA, GDPR, SaMD, SOC 2, BAAs)               | IEC venture (Founder/Legal) | Market- and time-gated; start early.            |
| Security operations (pen test, IR runbook, on-call)               | Joint                       | Shiora drafts technical runbooks.               |
| Go-to-market, customers, support                                  | IEC venture                 | The venture's core mandate.                     |

Who runs production day-to-day (Shiora, the venture, or jointly) is an **open item** — see §7.

---

## 7. Commercial terms — open items to negotiate

These are intentionally **not pre-decided**. They are listed so both sides can negotiate from a
clear menu:

- **License scope:** exclusive vs non-exclusive; territory; field of use.
- **IP ownership:** ownership of the Shiora core vs the venture's contributions; contribution-back
  terms for improvements.
- **Equity / revenue model:** equity split, licensing fees, and/or revenue share.
- **Production operations:** who runs and is accountable for production, and the support SLA.
- **Roadmap funding:** how continued platform engineering is funded.
- **Brand & data:** brand usage; data ownership and portability if the partnership ends.
- **Broader MBZUAI collaboration:** scope for follow-on initiatives beyond this venture.

---

## 8. The ask & next steps

1. **Candidate referrals.** Per our discussion, the IEC refers prospective founder/lead
   candidates; Shiora selects one after a direct interaction.
2. **Technical due diligence.** The venture team is invited to review this proposal, the
   production-readiness tracker (`docs/PRODUCTION_READINESS.md`), and the live
   `/api/system/status` surface.
3. **Term sheet.** Work the §7 open items into a term sheet.
4. **Phase 0 kickoff.** On agreement, provision infrastructure and cut the production baseline.

We are bringing our best, honestly-represented platform build to this partnership, and we see it
as the start of a longer collaboration with MBZUAI.

---

_Appendix — supporting documents in this repository:_
_`docs/PRODUCTION_READINESS.md` (12-domain status tracker), `docs/ARCHITECTURE.md`,
`docs/COMPLIANCE.md` (HIPAA control mapping), `docs/SECURITY.md`,
`docs/SECURITY_REMEDIATION.md`. Live transparency surface: `GET /api/system/status`._
