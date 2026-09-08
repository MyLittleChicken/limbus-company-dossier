import { createHash } from 'node:crypto';

/** Only this updater's domain. Paths remain compatible with the v2 readers. */
export function targetPath(source: string, path: string): string | null {
 if (path.startsWith('/') || path.split('/').some(p => p === '..' || p === '.')) return null;
 if (source === 'limbus-assets') {
  const detail = /^data\/(identities|egos)\/(\d+\.json)$/.exec(path);
  if (detail) return `entities/${detail[1] === 'identities' ? 'identity-details' : 'ego-details'}/${source}/${detail[2]}`;
  const core = /^data\/(identities|egos|statuses)\.json$/.exec(path);
  if (core) return `entities/${core[1] === 'statuses' ? 'mechanics' : core[1]}/${source}/${core[1]}.json`;
  const asset = /^assets\/(identities|egos|skills|statuses)\/([^/]+\.(?:webp|png|jpg|jpeg))$/i.exec(path);
  if (asset) return `assets/${asset[1]}/${source}/${asset[2]}`;
 }
 if (source === 'limbus-data-mj') {
  if (['identities.json','identities_detail.json','skills.json','passives.json','associations.json'].includes(path)) return `entities/identities/${source}/${path}`;
  if (['egos.json','egos_detail.json'].includes(path)) return `entities/egos/${source}/${path}`;
 }
 if (source.startsWith('loc-') && !path.includes('/') && path.endsWith('.json')) {
  if (/^(Egos|EgoSkills|EgoPassive|Skills_Ego|Passive_Ego)/.test(path)) return `entities/egos/${source}/${path}`;
  if (/^(Personalities|Skills|Passive|AssociationName|UnitKeyword)/.test(path)) return `entities/identities/${source}/${path}`;
  if (/^(Bufs|BattleKeywords)/.test(path)) return `entities/mechanics/${source}/${path}`;
 }
 return null;
}
export function snapshotId(heads: Record<string,string>): string {
 return createHash('sha256').update(JSON.stringify(Object.entries(heads).sort(([a],[b])=>a.localeCompare(b)))).digest('hex').slice(0,24);
}
