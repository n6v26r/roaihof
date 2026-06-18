import { scoreboardIdForContest } from '../lib/format';
import type { RankingKind } from '../lib/types';

export type ContestFamily = 'ONIA' | 'ROAI' | 'IAIO' | 'IOAI' | 'CEOAI';

export type Route =
  | { name: 'home' }
  | { name: 'rankings'; kind: RankingKind }
  | { name: 'person'; id: string }
  | { name: 'school'; id: string }
  | { name: 'county'; id: string }
  | { name: 'contest-family'; family: ContestFamily }
  | { name: 'scoreboard'; id: string }
  | { name: 'sources' }
  | { name: 'not-found' };

export function parseRoute(pathname: string): Route {
  const parts = pathname.replace(/\/+$/, '').split('/').filter(Boolean).map(decodeURIComponent);
  if (parts.length === 0) return { name: 'home' };
  if (parts[0] === 'sources' && parts.length === 1) return { name: 'sources' };
  if (parts[0] === 'rankings' && ['people', 'schools', 'counties'].includes(parts[1])) {
    return { name: 'rankings', kind: parts[1] as RankingKind };
  }
  if (parts[0] === 'people' && parts[1]) return { name: 'person', id: parts[1] };
  if (parts[0] === 'schools' && parts[1]) return { name: 'school', id: parts[1] };
  if (parts[0] === 'counties' && parts[1]) return { name: 'county', id: parts[1] };
  if (parts[0] === 'scoreboards' && parts[1]) return { name: 'scoreboard', id: parts[1] };
  if (parts[0] === 'contests' && isContestFamily(parts[1])) return { name: 'contest-family', family: parts[1].toUpperCase() as ContestFamily };
  if (parts[0] === 'contests' && parts[1]) return { name: 'scoreboard', id: scoreboardIdForContest(parts[1]) };
  return { name: 'not-found' };
}

export function isContestFamily(value?: string): boolean {
  return ['onia', 'roai', 'iaio', 'ioai', 'ceoai'].includes((value ?? '').toLowerCase());
}
