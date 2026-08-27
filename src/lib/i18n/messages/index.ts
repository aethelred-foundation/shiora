import type { Locale } from '../config';
import { en, type Messages } from './en';
import { ar } from './ar';

export type { Messages };

/** Every locale's message catalog, keyed by locale. */
export const CATALOGS: Record<Locale, Messages> = { en, ar };
