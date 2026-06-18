import type { Result } from './types';

export function buildEffectivePlaceOverrides(results: Result[]): Map<string, number> {
  const byContest = new Map<string, Result[]>();
  for (const result of results) {
    if (!usesROAI2025ClassPlacement(result)) continue;
    const rows = byContest.get(result.contestId) ?? [];
    rows.push(result);
    byContest.set(result.contestId, rows);
  }

  const overrides = new Map<string, number>();
  for (const rows of byContest.values()) {
    const sorted = [...rows].sort((a, b) => placeForSort(a.place) - placeForSort(b.place) || a.personName.localeCompare(b.personName));
    let previousPlace: number | undefined;
    let displayPlace = 0;
    sorted.forEach((result, index) => {
      if (result.place !== previousPlace) {
        displayPlace = index + 1;
        previousPlace = result.place;
      }
      overrides.set(result.id, displayPlace);
    });
  }
  return overrides;
}

export function usesROAI2025ClassPlacement(result: Result): boolean {
  return result.circuit === 'ROAI' &&
    result.year === 2025 &&
    result.stage === 'national' &&
    result.contestId.startsWith('roai-2025-national-clasa-');
}

function placeForSort(place?: number): number {
  return place && place > 0 ? place : 1_000_000;
}
