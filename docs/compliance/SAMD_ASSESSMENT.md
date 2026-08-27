# Shiora — Software as a Medical Device (SaMD) Assessment

> **Status: internal regulatory-position analysis — NOT legal advice.** This is
> Shiora's reasoned, documented position on whether its features constitute a
> medical device, written to be handed to qualified regulatory counsel. A
> **determination** (and any clearance/registration) is counsel- and
> regulator-gated. Nothing here is a legal opinion or an FDA determination.

- **Frameworks applied:** IMDRF SaMD risk categorization (state of the healthcare
  situation × significance of information provided); FDA 21st Century Cures Act
  §3060 Clinical Decision Support (CDS) exclusion criteria and the FDA CDS
  guidance; FDA General Wellness policy.
- **Date:** 2026-06-28. **Owner:** Ramesh Tamilselvan.

---

## 1. Overall position

Shiora is, at its core, a **patient-controlled health-data management and
infrastructure platform** (encrypted records, consent, access control, audit,
privacy rights). Data-management and security infrastructure is **not** a medical
device. The features that touch clinical interpretation were **deliberately
engineered to stay on the non-device side of the line** — most importantly SANA,
which is built as a non-diagnostic, informational/navigational assistant with
guardrails *enforced in code*.

**One feature warrants formal counsel review before any contraception/conception
claim:** the cycle/fertility analytics. See §3.

---

## 2. Per-feature determination

| Feature | What it does | IMDRF / Cures-Act analysis | Position |
|---|---|---|---|
| Encrypted records, consent, access grants, audit, GDPR rights | Stores, shares (with consent), and audits health data | Data management/administrative software; does not analyze data to inform a clinical decision | **Not a device** |
| ZKP, MPC, IPFS, content addressing | Cryptographic privacy/integrity infrastructure | Security infrastructure; no clinical claim | **Not a device** |
| Population & care-gap analytics | De-identified, k-anonymity-suppressed cohort statistics for plans/governments | Aggregate/operational analytics on de-identified data; not patient-specific clinical guidance | **Not a device** (administrative/operational) |
| Clinical notes (provider-authored, append-only) | Lets a provider record/amend notes about a patient | An electronic record of the provider's own documentation; the platform does not interpret it | **Not a device** (EHR-like recordkeeping) |
| **SANA assistant** | Patient-facing informational/navigational chat | See §2.1 | **Designed to be non-device** — informational/CDS-exempt + general-wellness, *by enforced design* |
| **Cycle / fertility-window analytics** | Predicts cycle phase / fertile window from the user's own logged data | See §3 | **Flag for counsel** before any contraception/conception use claim |

### 2.1 SANA — why it is engineered to be non-device

SANA is the feature most likely to be mistaken for SaMD, so its non-device
posture is enforced in code, not just policy
([`src/lib/api/sana/guardrails.ts`](../../src/lib/api/sana/guardrails.ts)):

- **It does not diagnose, prescribe, or recommend treatment.** A hard
  non-diagnostic system prompt forbids stating a condition, prescribing, or
  changing treatment; every reply is screened for diagnosis/dosing/treatment
  drift and always carries a not-medical-advice disclaimer.
- **It intercepts emergencies/crises with a fixed response — without invoking the
  model** — and directs the user to emergency/crisis services. It does not
  "analyze a medical signal" to triage; it screens text and routes to humans.
- **It is informational and navigational** — explaining general concepts, helping
  a user understand their *own* records, and helping prepare questions for their
  clinician.

Against the **Cures Act CDS exclusion** and **FDA CDS guidance**, software that
provides general information and does **not** provide a specific
patient-management directive, and whose limitations are transparent, falls
outside the device definition. Against the **General Wellness** policy, an
informational tool that promotes a healthy lifestyle without a disease
diagnosis/treatment claim is low-risk and non-device. SANA is built to satisfy
both. It is registered honestly in the maturity registry as `pilot` and
**"NOT a medical device."**

**Counsel note:** the non-device posture depends on SANA *staying* non-diagnostic.
Any future change that has it interpret data to recommend patient-specific
clinical action would re-open this analysis and likely make it SaMD.

---

## 3. The one item to take to counsel: fertility-window prediction

`vault-service.ts` derives cycle phase and a predicted fertile window from the
user's own logged period data (`computeCycleAnalytics`). The regulatory line here
is **claim-dependent**:

- Presented purely as an **informational reflection of the user's own logged
  data** ("based on your logs, your next period is predicted around X"), with no
  contraception/conception claim, it is analogous to a menstrual-tracking wellness
  tool — generally **non-device**.
- Presented or marketed for **contraception or to achieve pregnancy**, it crosses
  into a regulated **contraceptive/fertility device** (cf. FDA De Novo clearance
  precedents for fertility-based contraceptive software). That requires a formal
  pathway.

**Position:** keep the feature framed as informational tracking of the user's own
data, with no contraception/conception efficacy claim, **and obtain a counsel
determination before any such claim or marketing.** This is the single SaMD item
that should not ship a clinical claim without legal sign-off.

---

## 4. IMDRF risk framing (for the counsel brief)

| Feature | Healthcare situation | Significance of info | IMDRF category (if it *were* SaMD) |
|---|---|---|---|
| SANA (as built) | Non-serious / general | Informs general understanding | Below SaMD — informational, by design |
| Fertility window (informational) | Non-serious | Informs self-tracking | Low (I) — if framed as wellness |
| Fertility window (contraception claim) | Serious (pregnancy prevention) | Drives a clinical decision | Would be II+ — **device pathway required** |

---

## 5. Recommended actions

1. **Do not** make any diagnostic, contraceptive, or conception efficacy claim in
   product copy, marketing, or SANA output. (SANA's guardrails enforce the
   diagnostic part in code.)
2. Engage regulatory counsel with this brief specifically on the
   fertility-window feature before any related claim.
3. Re-run this assessment if SANA's scope, the analytics' patient-specificity, or
   the product's clinical claims change.
4. Keep the maturity registry labels (e.g. SANA "not a medical device") aligned
   with product reality — they are part of the honesty posture this analysis
   relies on.

---

*This document is Shiora's internal analysis to inform a regulatory
determination by qualified counsel. It is not legal advice and not an FDA
determination.*
