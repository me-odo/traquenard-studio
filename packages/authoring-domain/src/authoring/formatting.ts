import type { TypeRef } from '@traquenard/game-ir';

export function identifier(value: string): string {
  const words = value
    .trim()
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  return words
    .map((word, index) =>
      index === 0 ? word[0]!.toLowerCase() + word.slice(1) : word[0]!.toUpperCase() + word.slice(1),
    )
    .join('');
}

export function uniqueName(existing: readonly string[], base: string): string {
  if (!existing.includes(base)) return base;
  let suffix = 2;
  while (existing.includes(`${base}${suffix}`)) suffix += 1;
  return `${base}${suffix}`;
}

export function displayName(value: string): string {
  return value
    .replace(/[.-]/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function showType(type: TypeRef): string {
  return type.kind === 'collection' ? `Collection<${showType(type.element)}>` : type.kind;
}
