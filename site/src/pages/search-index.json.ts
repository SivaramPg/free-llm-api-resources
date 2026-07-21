import type { APIRoute } from 'astro';
import MiniSearch from 'minisearch';
import { getProviders } from '../data/parse-readme';
import { MINISEARCH_OPTIONS } from '../data/search-options';

export const GET: APIRoute = () => {
  const docs = getProviders().flatMap(p =>
    p.models.map((m, i) => ({
      id: `${p.slug}:${i}`,
      model: m.name,
      provider: p.name,
      slug: p.slug,
      category: p.category,
      phone: p.caveats.includes('phone-verification'),
      limits: (m.limits ?? p.limits ?? []).slice(0, 3).map(l => l.raw).join(' · '),
    })),
  );
  const mini = new MiniSearch(MINISEARCH_OPTIONS);
  mini.addAll(docs);
  return new Response(JSON.stringify(mini.toJSON()), {
    headers: { 'Content-Type': 'application/json' },
  });
};
