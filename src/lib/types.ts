export type EntityKind = 'person' | 'school' | 'county' | 'contest';
export type RankingKind = 'people' | 'schools' | 'counties';
export type Medal = 'gold' | 'silver' | 'bronze' | 'honorable' | '';
export type CircuitFilter = 'merged' | 'ONIA' | 'ROAI' | 'IOAI' | 'IAIO' | 'CEOAI' | 'international';
export type StageFilter = 'all' | 'national' | 'lot' | 'international';

export interface Dataset {
  generatedAt: string;
  summary: Summary;
  provenance: Source[];
  sourceStatuses: SourceStatus[];
  sourceTodos: SourceTodo[];
  people: Person[];
  schools: School[];
  counties: County[];
  contests: Contest[];
  results: Result[];
  rankings: Rankings;
  search: SearchItem[];
}

export interface Summary {
  people: number;
  schools: number;
  counties: number;
  contests: number;
  results: number;
  namedResults: number;
  anonymousResults: number;
  years: number[];
  circuits: string[];
  latestYear: number;
  mergedByDefault: boolean;
  roaiStatus: string;
  nationalCoverageScope: string;
}

export interface Source {
  id: string;
  title: string;
  url: string;
  accessedAt: string;
  status: string;
}

export interface SourceStatus {
  id: string;
  title: string;
  status: 'ok' | 'partial' | 'missing' | string;
  detail: string;
  url?: string;
  checked: string;
}

export interface SourceTodo {
  id: string;
  title: string;
  status: 'partial' | 'missing' | string;
  detail: string;
  url?: string;
}

export interface Stats {
  participations: number;
  nationalParticipations: number;
  internationalParticipations: number;
  lotParticipations: number;
  gold: number;
  silver: number;
  bronze: number;
  honorable: number;
  prizes: number;
  selections: number;
  ioaiSelections: number;
  ceoaiSelections: number;
  iaioSelections: number;
  uniqueContestants: number;
  bestPlace?: number;
  years: number[];
  circuits: string[];
}

export interface Person {
  id: string;
  name: string;
  aliases?: string[];
  externalUsernames?: ExternalUsernames;
  schoolIds: string[];
  countyIds: string[];
  stats: Stats;
}

export interface ExternalUsernames {
  judge?: string[];
  mlcompete?: string[];
}

export interface School {
  id: string;
  name: string;
  countyId?: string;
  county?: string;
  stats: Stats;
}

export interface County {
  id: string;
  name: string;
  stats: Stats;
}

export interface Contest {
  id: string;
  name: string;
  year: number;
  circuit: string;
  stage: string;
  section?: string;
  date?: string;
  city?: string;
  country?: string;
  officialUrl?: string;
  sourceId: string;
  resultsCount: number;
}

export interface Result {
  id: string;
  contestId: string;
  personId?: string;
  personName: string;
  schoolId?: string;
  school?: string;
  countyId?: string;
  county?: string;
  originalCounty?: string;
  locality?: string;
  year: number;
  circuit: string;
  stage: string;
  section?: string;
  grade?: string;
  place?: number;
  score?: number;
  scoreMax?: number;
  medal?: Medal;
  prize?: string;
  qualification?: string;
  status?: string;
  sourceId: string;
  anonymous: boolean;
}

export interface Rankings {
  people: RankingRow[];
  schools: RankingRow[];
  counties: RankingRow[];
}

export interface RankingRow {
  id: string;
  name: string;
  kind: 'person' | 'school' | 'county' | string;
  stats: Stats;
  rank?: number;
  matchedUsername?: SearchUsername;
}

export interface SearchItem {
  id: string;
  kind: EntityKind;
  title: string;
  subtitle: string;
  tokens: string[];
  usernames?: SearchUsername[];
}

export interface SearchUsername {
  platform: 'judge' | 'mlcompete';
  username: string;
}

export interface Filters {
  circuit: CircuitFilter;
  stage: StageFilter;
  query: string;
}
