import type { LucideIcon } from 'lucide-react';
import { compactNumber } from '../lib/format';

export function SummaryCard({ label, value, icon: Icon }: { label: string; value: number; icon: LucideIcon }) {
  return (
    <article className="summary-card">
      <Icon size={18} aria-hidden="true" />
      <span>{label}</span>
      <strong>{compactNumber(value)}</strong>
    </article>
  );
}
