import { AppLink } from '../lib/router';

export function NotFoundPage() {
  return (
    <section className="terminal-panel route-heading">
      <div>
        <p className="eyebrow">404</p>
        <h1>Not found</h1>
        <p className="muted-line">The requested route is not in the dataset.</p>
      </div>
      <AppLink href="/" className="meta-pill">Dashboard</AppLink>
    </section>
  );
}
