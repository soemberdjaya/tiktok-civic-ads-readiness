import { Layout, Footer } from '../ui/Layout';
import { t } from '../i18n';

export function Privacy() {
  return (
    <Layout section="privacy">
      <main className="mx-auto box-border w-full max-w-[760px] flex-1 p-4 sm:p-6">
        <h1 className="m-0 text-xl font-bold">{t.privacy.title}</h1>
        <p className="m-0 mt-1 text-[13px] text-muted">{t.privacy.updated}</p>
        <dl className="panel m-0 mt-5">
          {t.privacy.items.map(([term, body]) => (
            <div key={term} className="grid grid-cols-1 gap-1 border-b border-line-2 px-6 py-3.5 last:border-0 sm:grid-cols-[200px_1fr] sm:gap-4">
              <dt className="font-semibold">{term}</dt>
              <dd className="m-0 text-ink-2">{/^\S+@\S+$/.test(body) ? <a href={`mailto:${body}`}>{body}</a> : body}</dd>
            </div>
          ))}
        </dl>
        <Footer />
      </main>
    </Layout>
  );
}
