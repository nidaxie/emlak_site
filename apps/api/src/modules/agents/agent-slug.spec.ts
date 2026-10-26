import { allocateAgentSlug, nextSlug, slugifyCompanyName } from './agent-slug';

describe('agent slug', () => {
  it('builds a stable ascii slug', () => {
    expect(slugifyCompanyName('X Emlak')).toBe('x-emlak');
  });

  it('folds Turkish characters', () => {
    expect(slugifyCompanyName('Çağrı Şehir')).toBe('cagri-sehir');
  });

  it('falls back when the name has no slug characters', () => {
    expect(slugifyCompanyName('---')).toBe('emlakci');
  });

  it('reserves the agents/me path', () => {
    expect(slugifyCompanyName('Me')).toBe('me-1');
  });

  it('appends the next free numeric suffix', () => {
    expect(nextSlug('x-emlak', new Set(['x-emlak']))).toBe('x-emlak-2');
    expect(nextSlug('x-emlak', new Set(['x-emlak', 'x-emlak-2']))).toBe(
      'x-emlak-3',
    );
  });

  it('allocates the next free slug from existing rows', async () => {
    const slug = await allocateAgentSlug('X Emlak', () =>
      Promise.resolve(['x-emlak']),
    );

    expect(slug).toBe('x-emlak-2');
  });
});
