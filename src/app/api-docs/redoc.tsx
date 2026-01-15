'use client';
import dynamic from 'next/dynamic';
import Link from 'next/link';

const RedocStandalone = dynamic(() => import('redoc').then((mod) => mod.RedocStandalone), { ssr: false });

const callouts = [
  {
    title: 'Base URL',
    body: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000',
  },
  {
    title: 'Auth',
    body: 'Send Authorization: Bearer <JWT>. activeRole must match namespace (buyer / transporter / admin).',
  },
  {
    title: 'Namespaced paths',
    body: 'Shim endpoints: /api/buyers/*, /api/sellers/*, /api/transporters/dashboard/*, /api/admin/dashboard/*, /api/admin/top-*.',
  },
  {
    title: 'Collections',
    body: 'Postman: docs/Tractive-API.postman_collection.json. OpenAPI: docs/openapi.yaml (rendered below).',
  },
];

export default function RedocPage() {
  return (
    <div style={{ minHeight: '100vh' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 320px' }}>
            <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 700, color: '#0f172a' }}>Tractive Platform API</h1>
            <p style={{ margin: '8px 0 16px', color: '#475569' }}>
              Redoc view of docs/openapi.yaml. Use the quick notes to keep calls aligned with frontend expectations.
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
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {callouts.map((c) => (
              <div
                key={c.title}
                style={{
                  background: '#f8fafc',
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
        <RedocStandalone specUrl="/docs/openapi.yaml" />
      </div>
    </div>
  );
}
