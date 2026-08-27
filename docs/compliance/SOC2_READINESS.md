# Shiora — SOC 2 Readiness Assessment

> **Status: control self-assessment for readiness — NOT a SOC 2 report.** A SOC 2
> report is issued only by a licensed CPA firm after examining whether controls
> are *suitably designed* (Type I) and *operating effectively over a period*
> (Type II, typically 3–12 months of evidence). This document maps Shiora's
> controls to the AICPA Trust Services Criteria and identifies the gaps that must
> close before a Type I, and the evidence collection that a Type II window
> requires. It is the input a CPA firm and a readiness consultant start from.

- **Trust Services Categories assessed:** Security (Common Criteria, required) +
  **Confidentiality**, **Privacy**, **Availability** (relevant to a PHI platform).
  Processing Integrity is in scope for the MPC/analytics outputs.
- **Maturity legend:** ✅ designed & implemented (code) · 🟡 partial · 📋 process
  (org must author/operate) · ⛔ gap.

---

## 1. Common Criteria (Security) — CC1–CC9

| Criterion | Intent | Shiora status | Evidence / gap |
|---|---|---|---|
| **CC1** Control environment | Governance, integrity, accountability | 📋 | Org-level: code of conduct, org chart, board oversight must be documented. Honest-status discipline (maturity registry) is a cultural control already in code. |
| **CC2** Communication & information | Internal/external comms of objectives | 🟡 | `GET /api/system/status` publishes honest feature maturity; `docs/COMPLIANCE.md` communicates posture. **Gap:** formal policy comms, customer-facing trust page. |
| **CC3** Risk assessment | Identify & analyze risk | ✅/📋 | [HIPAA_RISK_ASSESSMENT.md](HIPAA_RISK_ASSESSMENT.md) is a NIST 800-30 risk analysis with register. **Gap:** make it a recurring, board-reviewed process. |
| **CC4** Monitoring activities | Evaluate & remediate deficiencies | 🟡 | Tamper-evident audit chain + subject-side disclosure log. **Gap:** continuous monitoring/alerting, periodic control testing. |
| **CC5** Control activities | Policies & procedures over tech | ✅/📋 | RBAC, encryption, validation are code-enforced. **Gap:** written policies behind them. |
| **CC6.1** Logical access — restrict | Least privilege, authorization | ✅ | `rbac.ts`/`capabilities.ts` 6-role matrix; owner-scoped data; grant-gated, time-bounded provider access. |
| **CC6.2** Registration / authorization | Provision/deprovision access | 🟡 | Role assignment (`roles-service.ts`); admin allowlist + government role. **Gap:** documented joiner/mover/leaver process. |
| **CC6.3** Access removal | Timely revocation | ✅ | Grant revocation (`DELETE /api/access/[id]`), consent revoke/expiry/auto-renew engine, session TTL. |
| **CC6.6** Boundary protection | Protect against external threats | 🟡 | CORS + distributed rate limiter (`pg-rate-limiter.ts`). **Gap:** WAF, edge DDoS, TLS floor/HSTS (R-4). |
| **CC6.7** Data in transit/at rest | Encryption | 🟡 | At rest ✅ (AES-256-GCM envelope). In transit 🟡 (TLS at edge; enforce floor + HSTS — R-4). |
| **CC6.8** Malicious software / integrity | Detect unauthorized changes | ✅ | GCM auth tags + audit-chain hashing; CID/MPC integrity. |
| **CC7.1** Detection / monitoring | Detect security events | 🟡 | Durable audit trail, disclosure log. **Gap:** SIEM/alerting, anomaly detection. |
| **CC7.2** Incident response | Respond to incidents | 📋 | **Gap:** documented IR plan, breach-notification runbook (ties to BAA §164.410). |
| **CC7.3 / 7.4** Recovery | Mitigate & recover | 📋 | **Gap:** backup/restore + DR runbook (Postgres). Migration runner (`migrator.ts`) supports controlled schema change. |
| **CC8.1** Change management | Authorize, test, deploy changes | ✅/🟡 | **100% test-coverage gate** + lint + type-check on every change; versioned migrations. **Gap:** documented change-approval/release process. |
| **CC9** Risk mitigation / vendors | Vendor & business-disruption risk | 🟡 | [BUSINESS_ASSOCIATE_AGREEMENTS.md](BUSINESS_ASSOCIATE_AGREEMENTS.md) subprocessor register. **Gap:** signed BAAs, vendor reviews. |

---

## 2. Confidentiality

| Criterion | Status | Evidence / gap |
|---|---|---|
| C1.1 Identify & protect confidential info | ✅ | ePHI inventory + envelope encryption (see risk assessment §1–2). |
| C1.2 Dispose of confidential info | 🟡 | Crypto-shredding via key destruction; GDPR Art. 17 erasure (`privacy.ts`). **Gap:** documented retention/disposal schedule; content-addressed-blob unpin caveat. |

## 3. Privacy (relevant TSC privacy criteria)

| Criterion | Status | Evidence |
|---|---|---|
| P access / correction | ✅ | Data-subject export (`privacy.ts`), profile management, clinical-note amendments (append-only). |
| P disclosure to third parties | ✅ | Consent grants + access grants, all audited; subject-side disclosure log (`/api/me/access-log`). |
| P erasure / retention | ✅/🟡 | Art. 17 erasure across every store; retention schedule = 📋. |
| P consent | ✅ | Consent lifecycle with expiry/auto-renew, revocation, notifications. |

## 4. Availability

| Criterion | Status | Gap |
|---|---|---|
| A1 capacity / monitoring / recovery | 🟡 | `/api/health/live` + `/api/health/ready`; distributed rate limiting. **Gap:** SLOs, capacity monitoring, backup/DR (CC7.3/7.4). |

## 5. Processing Integrity (MPC / analytics)

| Criterion | Status | Evidence |
|---|---|---|
| PI accuracy / completeness | ✅ | Real Shamir secure aggregation (tested for exact sums); k-anonymity-suppressed analytics; CID integrity for stored content. |

---

## 6. Gap summary → path to Type I, then Type II

**Designed-and-implemented today (code):** logical access control (CC6.1/6.3),
encryption at rest (CC6.7), integrity (CC6.8), change-management testing gate
(CC8.1), privacy rights (P), processing integrity (PI).

**Must close for a credible Type I (design):**
1. Written policies behind the code controls (CC1/CC2/CC5/CC7.2).
2. TLS floor + HSTS + edge protection (CC6.6/6.7 — R-4).
3. KMS/HSM key custody (R-1).
4. IR + backup/DR runbooks (CC7.2/7.3/7.4).
5. Executed BAAs + vendor reviews (CC9).

**Then for Type II (operating effectiveness):** run the controls over a 3–12
month window and collect evidence — access reviews, audit-chain verification
runs, change-management records (the CI gate already produces these per commit),
monitoring alerts, incident logs. The CI 100%-coverage + lint + type-check gate
and the tamper-evident audit chain are strong, machine-produced evidence sources
for that window.

---

*Owner: Ramesh Tamilselvan. This is a readiness self-assessment; only a licensed
CPA firm can issue a SOC 2 report.*
