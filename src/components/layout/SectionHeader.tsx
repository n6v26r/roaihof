import { ArrowUpRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { AppLink } from '../../lib/router';

export function SectionHeader({
  icon: Icon,
  title,
  meta,
  href
}: {
  icon: LucideIcon;
  title: string;
  meta?: string;
  href?: string;
}) {
  return (
    <div className="section-header">
      <h2>
        <Icon size={17} aria-hidden="true" />
        {title}
      </h2>
      {href ? (
        <AppLink href={href} className="section-link">
          {meta}
          <ArrowUpRight size={14} />
        </AppLink>
      ) : (
        <span>{meta}</span>
      )}
    </div>
  );
}
