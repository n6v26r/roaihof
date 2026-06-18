import type { Stats } from '../lib/types';
import { compactNumber } from '../lib/format';

interface StatGridProps {
  stats: Stats;
  variant?: 'entity' | 'national' | 'lot' | 'international';
  extras?: Array<{ label: string; value: string | number }>;
}

export function StatGrid({ stats, variant = 'entity', extras = [] }: StatGridProps) {
  const items = statItems(stats, variant, extras);

  return (
    <div className="stat-grid">
      {items.map((item) => (
        <div className="stat-card" key={item.label}>
          <span>{item.label}</span>
          <strong>{typeof item.value === 'number' ? compactNumber(item.value) : item.value}</strong>
        </div>
      ))}
    </div>
  );
}

function statItems(stats: Stats, variant: NonNullable<StatGridProps['variant']>, extras: Array<{ label: string; value: string | number }>) {
  const medals = [
    { label: 'Aur', value: stats.gold },
    { label: 'Argint', value: stats.silver },
    { label: 'Bronz', value: stats.bronze }
  ];
  const participations = { label: 'Participări', value: stats.participations };
  if (variant === 'international') {
    return [
      ...medals,
      participations,
      ...(stats.bestPlace ? [{ label: 'Best international', value: `#${stats.bestPlace}` }] : []),
      ...extras
    ];
  }
  if (variant === 'national') {
    return [...medals, participations, ...extras];
  }
  if (variant === 'lot') {
    return [
      participations,
      ...(stats.selections ? [{ label: 'Selecții', value: stats.selections }] : []),
      ...(stats.ioaiSelections ? [{ label: 'IOAI', value: stats.ioaiSelections }] : []),
      ...(stats.iaioSelections ? [{ label: 'IAIO', value: stats.iaioSelections }] : []),
      ...(stats.ceoaiSelections ? [{ label: 'CEOAI', value: stats.ceoaiSelections }] : []),
      ...extras
    ];
  }
  return [
    ...medals,
    participations,
    ...(stats.selections ? [{ label: 'Selecții', value: stats.selections }] : []),
    ...(stats.bestPlace ? [{ label: 'Best national', value: `#${stats.bestPlace}` }] : []),
    ...extras
  ];
}
