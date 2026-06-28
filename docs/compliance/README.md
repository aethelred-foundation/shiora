# Shiora — Compliance & Assurance Package

> **What this package is — and is not.**
>
> These documents are **Shiora's own work product**: the risk assessment,
> control mappings, agreements, test scope, and device-classification analysis
> that a covered entity / business associate produces *internally* and then hands
> to external auditors and counsel. They are the **evidence base and readiness
> artifacts** that feed a HIPAA risk-management program, a SOC 2 examination, a
> penetration-test engagement, and a regulatory (SaMD) determination.
>
> **They are not, and do not claim to be, any external attestation.** Shiora is
> **not** HIPAA-certified, SOC 2-attested, ISO 27001-certified, or HITRUST-certified,
> and nothing here is a legal opinion. Those outcomes are auditor-, examiner-,
> and counsel-gated; code and documentation cannot produce them. Every document
> states its status truthfully and marks what is an *operational control today*
> versus what is *planned* or *requires a third party*.

This package is deliberately consistent with the honest-status discipline used
across the codebase: the machine-readable source of truth for what is *real*
versus *simulated* is the **feature maturity registry**
([`src/lib/api/maturity.ts`](../../src/lib/api/maturity.ts), exposed at
`GET /api/system/status`). Where this package describes a control as
"implemented," it cites the actual code, and that code's maturity is `production`
in the registry.

## Contents

| Document | Purpose | External counterpart it feeds |
|----------|---------|-------------------------------|
| [HIPAA_RISK_ASSESSMENT.md](HIPAA_RISK_ASSESSMENT.md) | NIST 800-30 risk analysis of ePHI, threats, and safeguards | HIPAA §164.308(a)(1)(ii)(A) risk analysis + ongoing risk management |
| [BUSINESS_ASSOCIATE_AGREEMENTS.md](BUSINESS_ASSOCIATE_AGREEMENTS.md) | BAA template + subprocessor/BAA register | Signed BAAs (§164.314(a)) with each business associate |
| [PENETRATION_TEST_PLAN.md](PENETRATION_TEST_PLAN.md) | Scope, rules of engagement, target inventory, self-assessment | An independent external penetration test |
| [SOC2_READINESS.md](SOC2_READINESS.md) | Trust Services Criteria control mapping + gap analysis | A SOC 2 Type I→II examination by a licensed CPA firm |
| [SAMD_ASSESSMENT.md](SAMD_ASSESSMENT.md) | IMDRF/FDA SaMD classification of each feature | A formal regulatory determination by qualified counsel |

The pre-existing [`docs/COMPLIANCE.md`](../COMPLIANCE.md) control matrix remains
the single per-control gap tracker; this package is the structured set of
deliverables built on top of it.

## How to use this with an auditor / counsel

1. **HIPAA:** Start from the risk assessment; the risk register and remediation
   plan are the inputs to a §164.308 risk-management process. Pair it with the
   BAA register before any production handling of PHI.
2. **SOC 2:** The readiness document is a control self-assessment, not evidence
   of operating effectiveness over a period. A Type II examination requires the
   controls to *run* over an observation window (typically 3–12 months) with
   collected evidence; the gap list says what must be true before that window.
3. **Pen test:** The plan is a scope and rules-of-engagement document plus an
   internal self-assessment. Findings labeled "self-identified" are not a
   substitute for independent testing.
4. **SaMD:** The assessment is a reasoned internal position (built around SANA
   being deliberately non-diagnostic). It is the brief you hand to regulatory
   counsel — not the determination itself.

---

*Owner: Ramesh Tamilselvan. Last reviewed: 2026-06-28. These are living
documents; revise them whenever a control, vendor, or feature changes.*
