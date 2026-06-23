import type { Medal, Result, Stats } from './types';

export function compactNumber(value: number): string {
  return new Intl.NumberFormat('en', { maximumFractionDigits: 1 }).format(value);
}

export function score(value?: number): string {
  if (value === undefined || value === null) return '-';
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, '');
}

export function scoreWithMax(result: Pick<Result, 'score' | 'scoreMax'>): string {
  const value = score(result.score);
  if (value === '-') return '-';
  return result.scoreMax ? `${value}/${score(result.scoreMax)}` : value;
}

export function medalLabel(medal?: Medal): string {
  switch (medal) {
    case 'gold':
      return 'Aur';
    case 'silver':
      return 'Argint';
    case 'bronze':
      return 'Bronz';
    case 'honorable':
      return 'Honorable';
    default:
      return '-';
  }
}

export function stageLabel(stage: string): string {
  switch (stage) {
    case 'national':
      return 'Națională';
    case 'lot':
      return 'Lot';
    case 'baraj':
      return 'Baraj';
    case 'international':
      return 'Internațional';
    default:
      return stage;
  }
}

export function routeFor(kind: string, id: string): string {
  if (kind === 'person') return `/people/${id}`;
  if (kind === 'school') return `/schools/${id}`;
  if (kind === 'county') return `/counties/${id}`;
  if (kind === 'contest') return scoreboardRouteForContest(id);
  return '/';
}

export function scoreboardRouteForContest(id: string): string {
  return `/scoreboards/${scoreboardIdForContest(id)}`;
}

export function scoreboardIdForContest(id: string): string {
  return contestScoreboardIds[id] ?? id;
}

const contestScoreboardIds: Record<string, string> = {
  'onia-2026-nationala': 'onia-2026-nationala-full',
  'onia-2026-lot': 'onia-2026-lot',
  'roai-2026-national-ix-x': 'roai-2026-ix-x',
  'roai-2026-national-xi-xii': 'roai-2026-xi-xii',
  'roai-2026-baraj': 'roai-2026-baraj',
  'roai-2026-lot-ceoai': 'roai-2026-lot',
  'roai-2026-lot-iaio': 'roai-2026-lot',
  'roai-2025-national-clasa-9': 'roai-2025-clasa-9',
  'roai-2025-national-clasa-10': 'roai-2025-clasa-10',
  'roai-2025-national-clasa-11': 'roai-2025-clasa-11',
  'roai-2025-national-clasa-12': 'roai-2025-clasa-12',
  'roai-2025-lot-iaio': 'roai-2025-lot',
  'roai-2025-lot-ioai': 'roai-2025-lot',
  'iaio-2026': 'iaio-2026-global',
  'iaio-2024': 'iaio-2024-global',
  'ioai-2025': 'ioai-2025-individual',
  'ioai-2024-practical': 'ioai-2024-practical',
  'ioai-2024-theory': 'ioai-2024-theory'
};

export function ordinalPlace(place?: number): string {
  if (!place) return '';
  const lastTwo = place % 100;
  const suffix = lastTwo >= 11 && lastTwo <= 13
    ? 'th'
    : place % 10 === 1
      ? 'st'
      : place % 10 === 2
        ? 'nd'
        : place % 10 === 3
          ? 'rd'
          : 'th';
  return `${place}${suffix} place`;
}

export function resultOutcome(result: Result): { label: string; kind: 'prize' | 'qualification' | 'guest' | 'empty' } {
  if (result.status === 'guest' || result.status === 'guests') {
    return { label: 'GUEST', kind: 'guest' };
  }
  if (result.prize) {
    return { label: result.prize, kind: 'prize' };
  }
  if (result.qualification) {
    return { label: result.qualification, kind: 'qualification' };
  }
  return { label: '-', kind: 'empty' };
}

export function resultPrize(result: Result): string {
  return resultOutcome(result).label;
}

export function statLine(stats: Stats): string {
  return `${stats.gold}/${stats.silver}/${stats.bronze} · ${stats.participations} participări`;
}

export function formatRomanianDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('ro-RO', {
    dateStyle: 'short',
    timeStyle: 'medium',
    timeZone: 'Europe/Bucharest'
  }).format(date);
}
