// English message catalog (GAP-25) — the source of truth. Its shape defines the
// `Messages` type, so every other locale is compile-time required to supply the
// same keys. English values match the current UI copy, so components that adopt
// `t(...)` render identically under the default locale (and existing tests stay
// green).

export const en = {
  app: {
    name: 'Shiora on Aethelred',
    tagline: "Women's Health Data Platform",
  },
  common: {
    save: 'Save',
    cancel: 'Cancel',
    close: 'Close',
    confirm: 'Confirm',
    delete: 'Delete',
    loading: 'Loading…',
    retry: 'Retry',
    search: 'Search',
    connectWallet: 'Connect Wallet',
    disconnect: 'Disconnect',
  },
  language: {
    title: 'Language & Region',
    description: 'Choose the display language. Right-to-left scripts mirror the entire interface.',
    label: 'Language',
    current: 'Current language: {name}',
    rtlNote: 'This language is displayed right-to-left.',
    ltrNote: 'This language is displayed left-to-right.',
  },
  nav: {
    dashboard: 'Dashboard',
    records: 'Health Records',
    chat: 'Health Assistant',
    insights: 'Health Insights',
    vault: 'Data Vault',
    access: 'Access Control',
    compliance: 'Compliance Center',
    settings: 'Settings',
  },
  records: {
    // Plural forms selected via Intl.PluralRules (see pluralize()).
    count: {
      one: '{count} record',
      other: '{count} records',
    },
  },
};

/** Structural shape every locale catalog must satisfy (key parity, enforced by tsc). */
export type Messages = typeof en;
