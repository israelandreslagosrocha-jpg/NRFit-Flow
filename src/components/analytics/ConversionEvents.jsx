'use client';

import { useEffect } from 'react';

/**
 * Defines a privacy-preserving conversion-event contract for a future analytics
 * provider. It does not transmit or persist any data by itself. If an approved
 * provider later exposes window.dataLayer, the same non-identifying events are
 * available without changing conversion UI.
 */
export default function ConversionEvents() {
  useEffect(() => {
    const handleClick = (event) => {
      const target = event.target instanceof Element
        ? event.target.closest('[data-conversion-event]')
        : null;

      if (!target) return;

      const payload = {
        event: target.getAttribute('data-conversion-event'),
        placement: target.getAttribute('data-conversion-placement') || 'unknown',
      };

      window.dispatchEvent(new CustomEvent('naty:conversion', { detail: payload }));
      if (Array.isArray(window.dataLayer)) window.dataLayer.push(payload);
    };

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  return null;
}
