// ============================================================
// Shiora on Aethelred — FHIR R4 type subset
//
// A faithful (not exhaustive) subset of HL7 FHIR R4 data types and the resources
// Shiora ingests/emits. Kept deliberately small and strict so the parser can
// validate real EHR payloads (Epic/Cerner export the same shapes) and map them
// into the encrypted record store. Reference: https://hl7.org/fhir/R4/
// ============================================================

export interface FhirCoding {
  system?: string;
  code?: string;
  display?: string;
}

export interface FhirCodeableConcept {
  coding?: FhirCoding[];
  text?: string;
}

export interface FhirReference {
  reference?: string;
  display?: string;
}

export interface FhirQuantity {
  value?: number;
  unit?: string;
  system?: string;
  code?: string;
}

/** Resource types Shiora maps into health records. */
export type SupportedResourceType =
  | 'Observation'
  | 'Condition'
  | 'MedicationStatement'
  | 'AllergyIntolerance'
  | 'DiagnosticReport';

export interface FhirObservation {
  resourceType: 'Observation';
  id?: string;
  status?: string;
  category?: FhirCodeableConcept[];
  code?: FhirCodeableConcept;
  subject?: FhirReference;
  effectiveDateTime?: string;
  issued?: string;
  valueQuantity?: FhirQuantity;
  valueString?: string;
  performer?: FhirReference[];
}

export interface FhirCondition {
  resourceType: 'Condition';
  id?: string;
  clinicalStatus?: FhirCodeableConcept;
  verificationStatus?: FhirCodeableConcept;
  code?: FhirCodeableConcept;
  subject?: FhirReference;
  recordedDate?: string;
}

export interface FhirMedicationStatement {
  resourceType: 'MedicationStatement';
  id?: string;
  status?: string;
  medicationCodeableConcept?: FhirCodeableConcept;
  subject?: FhirReference;
  effectiveDateTime?: string;
  dateAsserted?: string;
}

export interface FhirAllergyIntolerance {
  resourceType: 'AllergyIntolerance';
  id?: string;
  clinicalStatus?: FhirCodeableConcept;
  code?: FhirCodeableConcept;
  patient?: FhirReference;
  criticality?: string;
  recordedDate?: string;
}

export interface FhirDiagnosticReport {
  resourceType: 'DiagnosticReport';
  id?: string;
  status?: string;
  code?: FhirCodeableConcept;
  subject?: FhirReference;
  effectiveDateTime?: string;
  issued?: string;
  conclusion?: string;
}

export type FhirResource =
  | FhirObservation
  | FhirCondition
  | FhirMedicationStatement
  | FhirAllergyIntolerance
  | FhirDiagnosticReport;

export interface FhirBundleEntry {
  fullUrl?: string;
  resource?: { resourceType?: string } & Record<string, unknown>;
}

export interface FhirBundle {
  resourceType: 'Bundle';
  type?: string;
  entry?: FhirBundleEntry[];
}
