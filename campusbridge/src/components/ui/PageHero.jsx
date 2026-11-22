// The forest banner at the top of listing pages: big title, short lead, and (optionally) a search field.
export default function PageHero({ title, lead, children, tone = 'amber' }) {
  return (
    <section className={`phero ${tone === 'sage' ? 'phero--sage' : ''}`}>
      <div className="container">
        <h1>{title}</h1>
        {lead && <p className="phero__lead">{lead}</p>}
        {children && <div className="phero__search">{children}</div>}
      </div>
    </section>
  );
}
