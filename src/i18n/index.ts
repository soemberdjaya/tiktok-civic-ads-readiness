import { en } from './en';

export const t = en;

/**
 * Fill {name} placeholders in a string. A string written "one|many" picks the
 * singular form when vars.n is 1, e.g. '{n} finding|{n} findings'.
 */
export function fmt(s: string, vars: Record<string, string | number>): string {
  const [one, many] = s.split('|');
  const form = many !== undefined && 'n' in vars ? (Number(vars.n) === 1 ? one! : many) : s;
  return form.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`));
}
