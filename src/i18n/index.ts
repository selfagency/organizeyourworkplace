import { en, type Catalog, type StringKey } from './en';
import { es } from './es';
import type { Locale } from './swap-locale';

export const catalogs: Record<Locale, Catalog> = { en, es };

export type { Locale, Catalog, StringKey };

/**
 * Format a catalog string, replacing {placeholders} with args.
 */
export function format(
  template: string,
  args: Record<string, string>,
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in args ? args[key] : match,
  );
}

export function t(locale: Locale, key: StringKey): string {
  return catalogs[locale][key];
}