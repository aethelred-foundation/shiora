# Shiora — Business Associate Agreements (BAA) Template & Register

> **Status: template + register (process artifact).** A BAA is a *signed legal
> contract* required by HIPAA §164.308(b) / §164.314(a) between a covered entity
> and each business associate (and between a business associate and its
> subcontractors) before PHI is created, received, maintained, or transmitted on
> its behalf. **This document does not constitute a signed BAA.** The template
> below must be reviewed by counsel and executed by both parties; the register
> tracks which agreements exist.

## Part A — When Shiora needs BAAs

- **Inbound:** If Shiora processes PHI *on behalf of* a covered entity (a
  provider organization, health plan, or their business associate), Shiora is a
  **business associate** and must sign a BAA with that covered entity.
- **Outbound (subcontractors):** Every downstream service that *creates,
  receives, maintains, or transmits* PHI on Shiora's behalf is a subcontractor
  and requires a BAA with Shiora (§164.314(a)(2)(iii)).

**Design note that shrinks BAA scope:** Shiora seals PHI before storage, so
subprocessors that only ever hold **ciphertext** (or content-addressed
ciphertext blobs) have materially reduced exposure — but a BAA is still required
wherever PHI (even encrypted) is handled, because encryption does not remove the
data from HIPAA's scope. The register below classifies each vendor's exposure.

---

## Part B — BAA template (clauses required by §164.314(a))

> Bracketed `[…]` fields are completed at execution. Have counsel review before use.

**Business Associate Agreement** between **[Covered Entity / Customer]** ("Covered
Entity") and **Shiora, operated by [Legal Entity]** ("Business Associate"),
effective **[date]**.

1. **Definitions.** Terms used have the meaning given in 45 CFR Parts 160 and 164.
2. **Permitted uses & disclosures.** Business Associate may use/disclose PHI only
   (a) as necessary to perform the services in the underlying agreement, (b) as
   required by law, and (c) for its proper management and to carry out legal
   responsibilities — and only consistent with the minimum-necessary standard.
3. **Prohibited uses.** Business Associate will not use or disclose PHI other than
   as permitted by this BAA or as required by law.
4. **Safeguards.** Business Associate will implement administrative, physical, and
   technical safeguards that reasonably and appropriately protect PHI, including
   compliance with the HIPAA Security Rule with respect to ePHI (see Shiora's
   [HIPAA_RISK_ASSESSMENT.md](HIPAA_RISK_ASSESSMENT.md) for the implemented
   technical safeguards).
5. **Subcontractors.** Business Associate will ensure that any subcontractor that
   creates, receives, maintains, or transmits PHI on its behalf agrees in writing
   to the same restrictions and conditions (the register in Part C).
6. **Reporting.** Business Associate will report to Covered Entity any use or
   disclosure not provided for by this BAA, any Security Incident, and any Breach
   of Unsecured PHI, without unreasonable delay and no later than **[N]** days
   after discovery (§164.410).
7. **Access, amendment, accounting.** Business Associate will make PHI available
   for access (§164.524), amendment (§164.526), and an accounting of disclosures
   (§164.528). *Shiora support:* data-subject export/erasure
   (`src/lib/api/privacy.ts`) and the subject-side disclosure log
   (`/api/me/access-log`) provide the technical means.
8. **Records to HHS.** Business Associate will make its internal practices, books,
   and records available to the Secretary of HHS for compliance determination.
9. **Return or destruction.** On termination, Business Associate will return or
   destroy all PHI if feasible; where infeasible, protections continue.
   *Shiora support:* envelope encryption + key destruction renders sealed PHI
   unrecoverable (crypto-shredding); note the content-addressed-storage caveat in
   the risk assessment (a CID-addressed blob can be unpinned, not force-deleted —
   crypto-shredding via key destruction is the operative control there).
10. **Term & termination.** Including the right of Covered Entity to terminate for
    material breach not cured within **[N]** days.
11. **Governing law / amendment / no third-party beneficiaries.** **[as advised]**.

Signatures: ___________________ (Covered Entity)  ___________________ (Business Associate)

---

## Part C — Subprocessor & BAA register

> Completed at deployment time. "PHI exposure" reflects Shiora's encrypt-then-store
> design: vendors that hold only ciphertext are flagged accordingly, but still
> require a BAA wherever PHI is handled. Replace `[…]` with the actual vendors
> chosen for the production deployment.

| Subprocessor | Role | PHI exposure | BAA required | BAA status |
|---|---|---|---|---|
| `[Cloud / hosting provider]` | Compute, networking, physical security | Ciphertext at rest + in-memory plaintext during processing | Yes | ☐ To execute |
| `[Managed Postgres provider]` | Encrypted datastore (`DATABASE_URL`) | Ciphertext (sealed PHI in JSONB) + plaintext audit metadata | Yes | ☐ To execute |
| `[KMS / HSM provider]` | KEK custody (planned — see R-1) | Key material, not PHI | Yes (key custody) | ☐ Pending KMS selection |
| `[IPFS node / pinning gateway]` (only if `IPFS_API_URL` set) | Content-addressed storage of **ciphertext** blobs | Ciphertext only (encrypt-then-address) | Yes | ☐ To execute if used |
| `[LLM provider — Anthropic]` (only if `ANTHROPIC_API_KEY` set) | SANA assistant inference | **Conversation content** is sent in plaintext to the provider at inference time | Yes — and zero-data-retention / no-training terms strongly advised | ☐ To execute if used |
| `[Email / contact provider]` | Out-of-band contact (if enabled) | Contact PII | Yes | ☐ To execute if used |

**Notes for the register owner:**
- The **default deployment uses neither IPFS nor the LLM provider** (local
  content-addressed store + deterministic offline SANA stub), which removes those
  two rows from scope until explicitly enabled by env config. This is by design:
  network subprocessors are opt-in.
- The **LLM row is the highest-sensitivity subprocessor** when enabled, because
  conversation content leaves the trust boundary in plaintext. Require a BAA with
  zero-data-retention and no-model-training terms, or keep SANA in offline stub
  mode.

---

*Owner: Ramesh Tamilselvan. This register must be reviewed before any production
handling of PHI and updated whenever a subprocessor is added, removed, or its PHI
exposure changes.*
