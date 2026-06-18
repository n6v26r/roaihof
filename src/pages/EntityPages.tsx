import { dataset } from '../app/data';
import type { Indexes } from '../app/indexes';
import { ExpandableRankingBlock } from '../components/ExpandableRankingBlock';
import { GroupedResultsTable } from '../components/GroupedResultsTable';
import { EntityPage, type UsernameMetaItem } from '../components/layout/EntityPage';
import { Subheading } from '../components/layout/Subheading';
import { routeFor } from '../lib/format';
import {
  aggregateRanking,
  defaultFilters,
  entityResults
} from '../lib/stats';
import type { County, Person, School } from '../lib/types';
import { NotFoundPage } from './NotFoundPage';

export function PersonPage({ person, indexes }: { person?: Person; indexes: Indexes }) {
  if (!person) return <NotFoundPage />;
  const results = entityResults('person', person.id, dataset);
  const schools = person.schoolIds.map((id) => indexes.schools.get(id)).filter(Boolean) as School[];
  const counties = person.countyIds.map((id) => indexes.counties.get(id)).filter(Boolean) as County[];

  return (
    <EntityPage
      eyebrow="Person"
      title={person.name}
      stats={person.stats}
      usernameMeta={externalUsernameMeta(person)}
      meta={[
        ...schools.map((school) => ({ label: school.name, href: routeFor('school', school.id) })),
        ...counties.map((county) => ({ label: county.name, href: routeFor('county', county.id) }))
      ]}
    >
      <GroupedResultsTable results={results} contests={indexes.contests} sources={indexes.sources} placementOverrides={indexes.placementOverrides} />
    </EntityPage>
  );
}

export function SchoolPage({ school, indexes }: { school?: School; indexes: Indexes }) {
  if (!school) return <NotFoundPage />;
  const results = entityResults('school', school.id, dataset);
  const topPeople = aggregateRanking('people', dataset, defaultFilters)
    .filter((row) => results.some((result) => result.personId === row.id));

  return (
    <EntityPage
      eyebrow="School"
      title={school.name}
      stats={school.stats}
      meta={school.countyId ? [{ label: school.county || school.countyId, href: routeFor('county', school.countyId) }] : []}
      extras={[{ label: 'Contestants', value: school.stats.uniqueContestants }]}
    >
      <div className="entity-detail-stack">
        <ExpandableRankingBlock title="Top contestants" rows={topPeople} kind="people" />
        <section className="entity-detail-block">
          <Subheading title="Participări" />
          <GroupedResultsTable results={results} contests={indexes.contests} sources={indexes.sources} compact placementOverrides={indexes.placementOverrides} />
        </section>
      </div>
    </EntityPage>
  );
}

export function CountyPage({ county, indexes }: { county?: County; indexes: Indexes }) {
  if (!county) return <NotFoundPage />;
  const results = entityResults('county', county.id, dataset);
  const topPeople = aggregateRanking('people', dataset, defaultFilters)
    .filter((row) => results.some((result) => result.personId === row.id));
  const topSchools = aggregateRanking('schools', dataset, defaultFilters)
    .filter((row) => results.some((result) => result.schoolId === row.id));

  return (
    <EntityPage
      eyebrow="County"
      title={county.name}
      stats={county.stats}
      extras={[{ label: 'Contestants', value: county.stats.uniqueContestants }]}
    >
      <div className="entity-detail-stack">
        <ExpandableRankingBlock title="Top schools" rows={topSchools} kind="schools" />
        <ExpandableRankingBlock title="Top contestants" rows={topPeople} kind="people" />
        <section className="entity-detail-block">
          <Subheading title="Participări" />
          <GroupedResultsTable results={results} contests={indexes.contests} sources={indexes.sources} compact placementOverrides={indexes.placementOverrides} />
        </section>
      </div>
    </EntityPage>
  );
}

function externalUsernameMeta(person: Person) {
  const usernames = person.externalUsernames;
  const meta: UsernameMetaItem[] = [];
  if (usernames?.judge?.length) {
    meta.push({ label: 'judge', platform: 'judge', usernames: usernames.judge });
  }
  if (usernames?.mlcompete?.length) {
    meta.push({
      label: 'mlcompete',
      platform: 'mlcompete',
      usernames: usernames.mlcompete,
      hrefs: usernames.mlcompete.map(mlcompeteProfileURL)
    });
  }
  return meta;
}

function mlcompeteProfileURL(username: string) {
  return `https://platform.olimpiada-ai.ro/ro/profile/${encodeURIComponent(username)}`;
}
