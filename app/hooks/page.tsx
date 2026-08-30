'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function HooksRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/hook-types');
  }, [router]);

  return (
    <div style={{ padding: '40px', color: '#94a3b8' }}>
      Redirecting to Hook Types...
    </div>
  );
}
