// ============================================================
// Shiora on Aethelred — SANA Guardrails
//
// SANA is a NON-DIAGNOSTIC informational and navigational health assistant. It
// is deliberately NOT a medical device: it does not diagnose, prescribe, or
// recommend treatment. The guardrails in this module enforce that boundary in
// code — they are the product, independent of the remote inference service.
//
// Three layers:
//   1. Input screening — intercept medical emergencies and self-harm crises and
//      return a fixed safety response WITHOUT calling the remote service. An
//      automated service must never stand between a user and emergency care.
//   2. Instruction contract — a hard, explicit non-diagnostic boundary.
//   3. Output screening — append a mandatory not-medical-advice disclaimer and
//      flag any response that drifts toward diagnosis/dosing/treatment changes.
//
// HONEST SCOPE: the input screen is a keyword/pattern heuristic, not clinical
// triage. It errs toward routing the user to real help, never toward assessing
// them. See the maturity registry entry `sana_assistant`.
// ============================================================

export type Intervention = 'crisis' | 'emergency';

export interface InputScreen {
  allowed: boolean;
  intervention?: Intervention;
  response?: string;
}

export interface OutputScreen {
  text: string;
  flags: string[];
}

// Self-harm / suicidal crisis — checked first (highest priority).
const CRISIS =
  /suicid|kill myself|killing myself|end my life|want to die|hurt myself|harm myself|self[- ]?harm/i;

// Acute medical emergency.
const EMERGENCY =
  /chest pain|can'?t breathe|cannot breathe|trouble breathing|severe bleeding|having a stroke|overdose|anaphyla|unconscious|not breathing/i;

const CRISIS_RESPONSE =
  'It sounds like you may be going through a crisis, and you are not alone — ' +
  'help is available right now. Please contact a crisis line: in the US, call or text 988 ' +
  '(Suicide & Crisis Lifeline). If you are in immediate danger, call your local emergency number ' +
  'now. SANA is not a substitute for emergency or crisis care.';

const EMERGENCY_RESPONSE =
  'This may be a medical emergency. Please call your local emergency number ' +
  '(such as 911 in the US) or go to the nearest emergency department now. SANA cannot assess ' +
  'emergencies and is not a substitute for professional emergency care.';

/** Intercept crises/emergencies before the remote service. Otherwise allow the message through. */
export function screenInput(text: string): InputScreen {
  if (CRISIS.test(text)) {
    return { allowed: false, intervention: 'crisis', response: CRISIS_RESPONSE };
  }
  if (EMERGENCY.test(text)) {
    return { allowed: false, intervention: 'emergency', response: EMERGENCY_RESPONSE };
  }
  return { allowed: true };
}

/** The hard non-diagnostic contract handed to the inference service on every turn. */
export function buildSystemPrompt(): string {
  return [
    'You are SANA, an informational and navigational assistant for the Shiora health platform.',
    'You are NOT a medical professional and you do NOT provide medical advice, diagnosis, or treatment.',
    'Rules you must always follow:',
    '- Never diagnose a condition or state (or imply) that the user has a specific disease.',
    '- Never prescribe medication, recommend a specific drug, or give a specific dosage.',
    '- Never tell the user to start, stop, or change a treatment or medication — tell them to consult their clinician.',
    '- For anything urgent or an emergency, tell the user to contact emergency services immediately.',
    '- You may explain general health concepts in plain language, help the user understand their own ' +
      'records, and help them prepare questions for their clinician.',
    '- Be clear and honest about your limits, and encourage the user to consult a licensed healthcare ' +
      'professional for anything specific to their health.',
  ].join('\n');
}

const DISCLAIMER =
  'SANA provides general information only and is not a substitute for professional ' +
  'medical advice, diagnosis, or treatment. Always consult a licensed clinician about your health.';

const PROHIBITED: [RegExp, string][] = [
  [/\byou (?:likely )?have\b|\bdiagnos/i, 'diagnosis'],
  [/\b\d+\s?(?:mg|milligrams|mcg|ml)\b/i, 'dosing'],
  [/stop taking|start taking|change your (?:dose|medication)/i, 'treatment-change'],
];

/**
 * Post-process a model response: flag any drift toward diagnosis/dosing/treatment
 * changes, and always append the not-medical-advice disclaimer.
 */
export function screenOutput(text: string): OutputScreen {
  const flags = PROHIBITED.filter(([pattern]) => pattern.test(text)).map(([, flag]) => flag);
  const caution =
    flags.length > 0
      ? '\n\n⚠️ This touches on diagnosis or treatment, which SANA cannot provide — please confirm ' +
        'anything specific with your clinician.'
      : '';
  return { text: `${text}${caution}\n\n— ${DISCLAIMER}`, flags };
}
