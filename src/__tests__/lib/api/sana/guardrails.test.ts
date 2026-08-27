/** @jest-environment node */

import { screenInput, buildSystemPrompt, screenOutput } from '@/lib/api/sana/guardrails';

describe('SANA guardrails — input screening', () => {
  it('intercepts a self-harm crisis before the remote service', () => {
    const result = screenInput('sometimes I want to die');
    expect(result.allowed).toBe(false);
    expect(result.intervention).toBe('crisis');
    expect(result.response).toMatch(/988/);
  });

  it('intercepts a medical emergency before the remote service', () => {
    const result = screenInput('I have severe chest pain right now');
    expect(result.allowed).toBe(false);
    expect(result.intervention).toBe('emergency');
    expect(result.response).toMatch(/emergency/i);
  });

  it('prioritizes crisis over emergency when both could match', () => {
    const result = screenInput('I want to hurt myself and I have chest pain');
    expect(result.intervention).toBe('crisis');
  });

  it('allows an ordinary informational question through', () => {
    expect(screenInput('what does an A1C test measure?')).toEqual({ allowed: true });
  });
});

describe('SANA guardrails — system prompt', () => {
  it('states the non-diagnostic contract', () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toMatch(/do NOT provide medical advice, diagnosis, or treatment/);
    expect(prompt).toMatch(/Never diagnose/);
    expect(prompt).toMatch(/Never prescribe/);
  });
});

describe('SANA guardrails — output screening', () => {
  it('appends the disclaimer to an ordinary response with no flags', () => {
    const { text, flags } = screenOutput(
      'An A1C test reflects average blood sugar over ~3 months.',
    );
    expect(flags).toEqual([]);
    expect(text).toMatch(/not a substitute for professional/);
    expect(text).not.toMatch(/⚠️/); // no caution when nothing is flagged
  });

  it('flags and cautions a response that drifts into diagnosis', () => {
    const { text, flags } = screenOutput('It sounds like you have diabetes.');
    expect(flags).toContain('diagnosis');
    expect(text).toMatch(/⚠️/);
  });

  it('flags dosing and treatment-change drift', () => {
    expect(screenOutput('take 500 mg twice daily').flags).toContain('dosing');
    expect(screenOutput('you should stop taking that').flags).toContain('treatment-change');
  });
});
