import Link from 'next/link';

const callouts = [
  {
    title: 'Base URL',
    body: process.env.NEXT_PUBLIC_API_BASE_URL || 'https://tractive-be.vercel.app',
  },
  {
    title: 'Auth',
    body: 'Send Authorization: Bearer <JWT>. Most endpoints require an activeRole that matches the namespace (buyer / transporter / admin).',
  },
  {
    title: 'Namespaced paths',
    body: 'Frontend-friendly shims live under /api/buyers/*, /api/sellers/*, /api/transporters/dashboard/*, /api/admin/dashboard/*, /api/admin/top-*.',
  },
  {
    title: 'Collections',
    body: 'Postman: docs/Tractive-API.postman_collection.json. OpenAPI: /docs/openapi.yaml.',
  },
  {
    title: 'Endpoint inventory',
    body: 'Full list for QA: docs/api-endpoints.txt and docs/api-endpoints.csv (workspace files).',
  },
];

export default function ApiDocsPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 320px' }}>
            <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 700, color: '#0f172a' }}>Tractive Platform API</h1>
            <p style={{ margin: '8px 0 16px', color: '#475569' }}>
              Swagger view of the live OpenAPI spec. Use the quick notes to keep calls aligned with frontend expectations.
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Link
                href="/api-docs"
                style={{
                  padding: '8px 12px',
                  background: '#0f172a',
                  color: '#f8fafc',
                  borderRadius: 8,
                  fontWeight: 700,
                  fontSize: 13,
                  textDecoration: 'none',
                }}
              >
                Swagger
              </Link>
              <Link
                href="/api-docs/redoc"
                style={{
                  padding: '8px 12px',
                  background: '#e2e8f0',
                  color: '#0f172a',
                  borderRadius: 8,
                  fontWeight: 700,
                  fontSize: 13,
                  textDecoration: 'none',
                  border: '1px solid #cbd5e1',
                }}
              >
                Redoc
              </Link>
              <a
                href="/docs/openapi.yaml"
                target="_blank"
                rel="noreferrer"
                style={{
                  padding: '8px 12px',
                  background: '#fff',
                  color: '#0f172a',
                  borderRadius: 8,
                  fontWeight: 700,
                  fontSize: 13,
                  textDecoration: 'none',
                  border: '1px solid #cbd5e1',
                }}
              >
                Raw YAML
              </a>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {callouts.map((c) => (
              <div
                key={c.title}
                style={{
                  background: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: 10,
                  padding: '10px 12px',
                  minWidth: 240,
                  maxWidth: 320,
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>{c.title}</div>
                <div style={{ fontSize: 13, color: '#475569', marginTop: 4 }}>{c.body}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div style={{ padding: '0 16px 24px' }}>
        <iframe
          title="Swagger Docs"
          src="/swagger.html?url=/docs/openapi.yaml"
          style={{
            width: '100%',
            minHeight: 'calc(100vh - 180px)',
            border: '1px solid #e2e8f0',
            borderRadius: 12,
            background: '#fff',
          }}
        />
      </div>
    </div>
  );
}
