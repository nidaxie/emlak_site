const turkishMap: Record<string, string> = {
  ç: 'c',
  ğ: 'g',
  ı: 'i',
  ö: 'o',
  ş: 's',
  ü: 'u',
  Ç: 'c',
  Ğ: 'g',
  İ: 'i',
  I: 'i',
  Ö: 'o',
  Ş: 's',
  Ü: 'u',
};

const reservedSlugs = new Set(['me']);

export function slugifyCompanyName(companyName: string): string {
  const mapped = Array.from(companyName.trim())
    .map((char) => turkishMap[char] ?? char)
    .join('')
    .toLowerCase();

  const slug = mapped
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');

  const base = slug.length > 0 ? slug : 'emlakci';

  return reservedSlugs.has(base) ? `${base}-1` : base;
}

export function nextSlug(base: string, taken: Set<string>): string {
  if (!taken.has(base)) {
    return base;
  }

  let suffix = 2;

  while (taken.has(`${base}-${suffix}`)) {
    suffix += 1;
  }

  return `${base}-${suffix}`;
}

export async function allocateAgentSlug(
  companyName: string,
  findTaken: (base: string) => Promise<string[]>,
): Promise<string> {
  const base = slugifyCompanyName(companyName);
  const taken = new Set(await findTaken(base));

  return nextSlug(base, taken);
}
