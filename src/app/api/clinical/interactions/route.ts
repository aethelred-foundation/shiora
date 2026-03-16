// ============================================================
// Shiora on Aethelred — Drug Interactions API
// GET /api/clinical/interactions — returns DrugInteraction[]
// ============================================================

import { NextRequest } from 'next/server';
import { successResponse } from '@/lib/api/responses';
import { runMiddleware } from '@/lib/api/middleware';
import { seededHex, generateAttestation } from '@/lib/utils';
import type { DrugInteraction, InteractionSeverity } from '@/types';

const SEED = 2100;

// ---- Drug interaction reference data ----

interface InteractionDef {
  drugA: string;
  drugB: string;
  severity: InteractionSeverity;
  mechanism: string;
  clinicalEffect: string;
  recommendation: string;
  evidence: DrugInteraction['evidenceLevel'];
}

const INTERACTION_DEFS: InteractionDef[] = [
  {
    drugA: 'Warfarin',
    drugB: 'Aspirin',
    severity: 'major',
    mechanism: 'Additive anticoagulant and antiplatelet effects; aspirin inhibits COX-1 platelet aggregation while warfarin inhibits vitamin K-dependent clotting factors.',
    clinicalEffect: 'Significantly increased risk of major bleeding including GI hemorrhage and intracranial bleeding.',
    recommendation: 'Avoid combination unless specifically indicated (e.g., mechanical heart valve). If concurrent use required, maintain INR 2.0-2.5 and add PPI for GI protection.',
    evidence: 'established',
  },
  {
    drugA: 'Metformin',
    drugB: 'Lisinopril',
    severity: 'minor',
    mechanism: 'ACE inhibitors may enhance the hypoglycemic effect of metformin through improved insulin sensitivity.',
    clinicalEffect: 'Mild increased risk of hypoglycemia, generally clinically insignificant.',
    recommendation: 'Monitor blood glucose during initiation of ACE inhibitor. Combination is generally safe and commonly prescribed.',
    evidence: 'probable',
  },
  {
    drugA: 'Warfarin',
    drugB: 'Amiodarone',
    severity: 'major',
    mechanism: 'Amiodarone inhibits CYP2C9 and CYP3A4, significantly decreasing warfarin metabolism and increasing its anticoagulant effect.',
    clinicalEffect: 'INR elevation of 40-60% within 1-2 weeks, markedly increased bleeding risk.',
    recommendation: 'Reduce warfarin dose by 30-50% when starting amiodarone. Monitor INR weekly for first 6 weeks, then biweekly.',
    evidence: 'established',
  },
  {
    drugA: 'Lisinopril',
    drugB: 'Spironolactone',
    severity: 'moderate',
    mechanism: 'Both drugs reduce aldosterone effects, leading to potassium retention. ACE inhibitors decrease aldosterone secretion; spironolactone blocks aldosterone receptors.',
    clinicalEffect: 'Risk of life-threatening hyperkalemia, especially in renal impairment or diabetes.',
    recommendation: 'Monitor serum potassium within 1 week of initiation and regularly thereafter. Avoid if eGFR < 30. Restrict dietary potassium.',
    evidence: 'established',
  },
  {
    drugA: 'Metformin',
    drugB: 'Iodinated Contrast',
    severity: 'major',
    mechanism: 'Contrast-induced nephropathy can impair metformin renal clearance, leading to dangerous accumulation and lactic acidosis.',
    clinicalEffect: 'Risk of metformin-associated lactic acidosis (MALA), a potentially fatal condition.',
    recommendation: 'Hold metformin 48 hours before and after contrast administration. Check eGFR before resuming. OK to continue if eGFR > 60 and low-volume contrast.',
    evidence: 'established',
  },
  {
    drugA: 'Aspirin',
    drugB: 'Ibuprofen',
    severity: 'moderate',
    mechanism: 'Ibuprofen competitively inhibits the COX-1 binding site on platelets, blocking aspirin from irreversibly acetylating the enzyme.',
    clinicalEffect: 'Reduced cardioprotective antiplatelet effect of aspirin when taken concurrently.',
    recommendation: 'Take aspirin at least 30 minutes before ibuprofen, or 8 hours after. Consider celecoxib as alternative NSAID if chronic therapy needed.',
    evidence: 'established',
  },
  {
    drugA: 'Sertraline',
    drugB: 'Tramadol',
    severity: 'major',
    mechanism: 'Both drugs increase serotonergic activity. SSRIs block serotonin reuptake; tramadol inhibits serotonin and norepinephrine reuptake.',
    clinicalEffect: 'Risk of serotonin syndrome: agitation, hyperthermia, myoclonus, tachycardia, and potentially death.',
    recommendation: 'Avoid combination when possible. If necessary, use lowest effective doses and monitor for serotonin syndrome symptoms. Educate patient on warning signs.',
    evidence: 'probable',
  },
  {
    drugA: 'Amlodipine',
    drugB: 'Simvastatin',
    severity: 'moderate',
    mechanism: 'Amlodipine inhibits CYP3A4, increasing simvastatin plasma concentrations and the risk of dose-dependent myotoxicity.',
    clinicalEffect: 'Increased risk of myopathy and rhabdomyolysis at higher simvastatin doses.',
    recommendation: 'Limit simvastatin to 20mg/day when co-administered with amlodipine. Consider switching to atorvastatin or rosuvastatin which are less affected.',
    evidence: 'established',
  },
];

export async function GET(request: NextRequest) {
  const blocked = runMiddleware(request);
  if (blocked) return blocked;

  const interactions: DrugInteraction[] = INTERACTION_DEFS.map((def, i) => ({
    id: `ddi-${seededHex(SEED + 400 + i * 7, 12)}`,
    drugA: def.drugA,
    drugB: def.drugB,
    severity: def.severity,
    mechanism: def.mechanism,
    clinicalEffect: def.clinicalEffect,
    recommendation: def.recommendation,
    evidenceLevel: def.evidence,
    teeVerified: true,
    attestation: generateAttestation(SEED + 400 + i * 13),
  }));

  return successResponse(interactions);
}
