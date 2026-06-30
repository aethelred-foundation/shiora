'use client';

// ============================================================
// Shiora on Aethelred — SealedField
//
// A textarea for a highly-sensitive free-text field, with the client-side
// sealing affordance: until the user unlocks (signs to derive their field key),
// the field is plain; once unlocked, the value is encrypted on-device before it
// is sent (selective end-to-end encryption — the server stores only ciphertext).
// Presentational — the encryption state and the unlock action are passed in
// (see useFieldKey); the consuming form seals the value before submit.
// ============================================================

import { Lock, ShieldCheck, Loader2 } from 'lucide-react';

export interface SealedFieldProps {
  value: string;
  onChange: (value: string) => void;
  isUnlocked: boolean;
  isUnlocking: boolean;
  onUnlock: () => void;
  placeholder?: string;
  rows?: number;
}

export function SealedField({
  value,
  onChange,
  isUnlocked,
  isUnlocking,
  onUnlock,
  placeholder,
  rows = 3,
}: SealedFieldProps) {
  return (
    <div className="space-y-1.5">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent resize-none"
      />
      {isUnlocked ? (
        <p className="flex items-center gap-1.5 text-xs text-emerald-600">
          <ShieldCheck className="w-3.5 h-3.5" />
          Encrypted on your device before sending
        </p>
      ) : (
        <button
          type="button"
          onClick={onUnlock}
          disabled={isUnlocking}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-brand-600 transition-colors disabled:opacity-60"
        >
          {isUnlocking ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Unlocking encryption…
            </>
          ) : (
            <>
              <Lock className="w-3.5 h-3.5" />
              Unlock client-side encryption
            </>
          )}
        </button>
      )}
    </div>
  );
}
