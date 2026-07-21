// Shared MiniSearch options, single source of truth for both the
// /search-index.json endpoint (which builds the index) and the Search
// island (which loads it via MiniSearch.loadJSON). These MUST stay
// byte-identical between producer and consumer, or loadJSON breaks silently.
export const MINISEARCH_OPTIONS = {
  fields: ['model', 'provider'],
  storeFields: ['model', 'provider', 'slug', 'category', 'phone', 'limits'],
};
