import {
  Database,
  Home,
  MapPinned,
  Moon,
  School2,
  Sun,
  Users
} from 'lucide-react';
import { AppLink } from '../../lib/router';

export function Header({ pathname, onToggleTheme }: { pathname: string; onToggleTheme: () => void }) {
  const links = [
    { href: '/', label: 'Dashboard', icon: Home },
    { href: '/rankings/people', label: 'People', icon: Users },
    { href: '/rankings/schools', label: 'Schools', icon: School2 },
    { href: '/rankings/counties', label: 'Counties', icon: MapPinned },
    { href: '/sources', label: 'Sources', icon: Database }
  ];

  return (
    <header className="site-header">
      <div className="brand-row">
        <AppLink href="/" className="brand-mark" aria-label="ROAIHOF dashboard">
          <span className="brand-glyph">AI</span>
          <span>
            <strong>ROAIHOF</strong>
            <small>Romanian AI Hall Of Fame</small>
          </span>
        </AppLink>
        <button type="button" className="theme-toggle" onClick={onToggleTheme} title="Switch theme" aria-label="Switch theme">
          <Sun size={16} className="theme-toggle-sun" aria-hidden="true" />
          <Moon size={16} className="theme-toggle-moon" aria-hidden="true" />
        </button>
      </div>
      <nav className="site-nav" aria-label="primary">
        {links.map((link) => {
          const Icon = link.icon;
          const active = link.href === '/' ? pathname === '/' : pathname.startsWith(link.href);
          return (
            <AppLink
              href={link.href}
              className={active ? 'nav-link active' : 'nav-link'}
              key={link.href}
              title={link.label}
              aria-label={link.label}
            >
              <span className="sr-only">{link.label}</span>
              <Icon size={16} aria-hidden="true" />
              {link.label}
            </AppLink>
          );
        })}
      </nav>
    </header>
  );
}
