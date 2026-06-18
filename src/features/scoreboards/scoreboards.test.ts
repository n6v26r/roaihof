import { describe, expect, it } from 'vitest';
import { dataset } from '../../app/data';
import { buildEffectivePlaceOverrides } from '../../lib/placements';
import {
  buildScoreboards,
  placementOverridesForScoreboard,
  scoreboardDetailTag,
  scoreboardOfficialLinks
} from './scoreboards';

describe('scoreboards', () => {
  const scoreboards = new Map(buildScoreboards(dataset).map((scoreboard) => [scoreboard.id, scoreboard]));

  it('uses class placement overrides for ROAI 2025 class scoreboards', () => {
    const scoreboard = scoreboards.get('roai-2025-clasa-9');
    const ilieResult = dataset.results.find((result) => result.contestId === 'roai-2025-national-clasa-9' && result.personId === 'ilie-goga-radu');
    const overrides = buildEffectivePlaceOverrides(dataset.results);

    expect(scoreboard).toBeDefined();
    expect(ilieResult?.place).toBe(24);
    expect(ilieResult).toBeDefined();
    expect(overrides.get(ilieResult!.id)).toBe(1);
    expect(placementOverridesForScoreboard(scoreboard!, overrides)?.get(ilieResult!.id)).toBe(1);
  });

  it('does not repeat class titles as scoreboard detail tags', () => {
    expect(scoreboardDetailTag(scoreboards.get('roai-2025-clasa-9')!)).toBeUndefined();
  });

  it('keeps special official source links', () => {
    expect(scoreboardOfficialLinks(scoreboards.get('onia-2026-lot')!)).toEqual([
      {
        label: 'round 1 final',
        href: 'https://platform.olimpiada-ai.ro/ro/competitions/23?tab=final',
        external: true
      },
      {
        label: 'round 2 final',
        href: 'https://platform.olimpiada-ai.ro/ro/competitions/24?tab=final',
        external: true
      }
    ]);
    expect(scoreboardOfficialLinks(scoreboards.get('roai-2025-national-ranking')!)).toEqual([{
      label: 'official source',
      href: 'https://judge.nitro-ai.org/competitions/roai-2025/onia/leaderboard/complete?page=1&page_size=200',
      external: true
    }]);
    expect(scoreboardOfficialLinks(scoreboards.get('roai-2026-lot')!)).toEqual([{
      label: 'official sources',
      href: 'https://olimpiada.nitro-ai.org/ro/2026/lot?section=tasks',
      external: true
    }]);
  });
});
