import { buildScoreboards, type Scoreboard } from '../features/scoreboards/scoreboards';
import { buildEffectivePlaceOverrides } from '../lib/placements';
import type { Contest, County, Dataset, Person, School, Source } from '../lib/types';

export interface Indexes {
  people: Map<string, Person>;
  schools: Map<string, School>;
  counties: Map<string, County>;
  contests: Map<string, Contest>;
  sources: Map<string, Source>;
  scoreboards: Map<string, Scoreboard>;
  placementOverrides: Map<string, number>;
}

export function buildIndexes(data: Dataset): Indexes {
  const scoreboards = buildScoreboards(data);
  return {
    people: new Map(data.people.map((item) => [item.id, item])),
    schools: new Map(data.schools.map((item) => [item.id, item])),
    counties: new Map(data.counties.map((item) => [item.id, item])),
    contests: new Map(data.contests.map((item) => [item.id, item])),
    sources: new Map(data.provenance.map((item) => [item.id, item])),
    scoreboards: new Map(scoreboards.map((item) => [item.id, item])),
    placementOverrides: buildEffectivePlaceOverrides(data.results)
  };
}
