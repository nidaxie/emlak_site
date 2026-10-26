'use client';

import { getHealth } from '@/services/health';
import { useEffect, useState } from 'react';

type Status = 'checking' | 'ok' | 'unavailable';

export function ApiStatus() {
  const [status, setStatus] = useState<Status>('checking');

  useEffect(() => {
    let active = true;

    getHealth()
      .then((health) => {
        if (active) {
          setStatus(health.status === 'ok' ? 'ok' : 'unavailable');
        }
      })
      .catch(() => {
        if (active) {
          setStatus('unavailable');
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const label =
    status === 'checking'
      ? 'Bağlantı kontrol ediliyor'
      : status === 'ok'
        ? 'API bağlı'
        : 'API şu anda ulaşılamıyor';

  return (
    <p className="mt-8 text-sm text-muted-foreground" role="status">
      <span
        className={
          status === 'ok'
            ? 'mr-2 inline-block size-2 rounded-full bg-emerald-600'
            : status === 'unavailable'
              ? 'mr-2 inline-block size-2 rounded-full bg-amber-600'
              : 'mr-2 inline-block size-2 rounded-full bg-zinc-400'
        }
        aria-hidden="true"
      />
      {label}
    </p>
  );
}
