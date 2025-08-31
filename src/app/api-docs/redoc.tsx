'use client';
import dynamic from 'next/dynamic';

const RedocStandalone = dynamic(() => import('redoc').then(mod => mod.RedocStandalone), { ssr: false });

export default function RedocPage() {
  return (
    <div style={{ height: '100vh' }}>
      <RedocStandalone specUrl="/docs/openapi.yaml" />
    </div>
  );
}
