export const SORT_OPTIONS = [
  { id: 'hot', name: '最热' },
  { id: 'new', name: '最新' },
  { id: 'score', name: '评分' }
];

export function catalogPlatforms(data) {
  return [...new Set(data.games.map(game => game.platform).filter(Boolean))];
}

export function catalogTypes(data) {
  const platforms = new Set(catalogPlatforms(data));
  return [...new Set(data.games.flatMap(game => game.tags || []))]
    .filter(tag => !platforms.has(tag));
}

export function catalogFilters(data, query) {
  const platform = query.get('platform') || '';
  const type = query.get('type') || '';
  const sort = query.get('sort') || 'hot';
  return {
    platform: catalogPlatforms(data).includes(platform) ? platform : '',
    type: catalogTypes(data).includes(type) ? type : '',
    sort: SORT_OPTIONS.some(option => option.id === sort) ? sort : 'hot'
  };
}

export function filterCatalog(games, { platform = '', type = '', sort = 'hot' } = {}) {
  const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  return games.filter(game => (!platform || game.platform === platform)
    && (!type || (game.tags || []).includes(type)))
    .sort((a, b) => {
      let order = 0;
      if (sort === 'new') order = String(b.releaseDate || '').localeCompare(String(a.releaseDate || ''));
      if (sort === 'score') order = number(b.score) - number(a.score);
      return order || number(b.players) - number(a.players) || String(a.id).localeCompare(String(b.id));
    });
}

export function catalogHref(path, filters, extra = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...extra, ...filters })) {
    if (value && !(key === 'sort' && value === 'hot')) params.set(key, value);
  }
  return `#${path}${params.size ? `?${params}` : ''}`;
}
