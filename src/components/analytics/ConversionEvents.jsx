'use client';

import { useEffect } from 'react';
import { emitConversion } from '../../lib/analytics-client';

/**
 * Whitelisted CTA events, only after consent. No raw dataLayer pushes: those
 * would bypass the provider's route and privacy checks.
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

      emitConversion(payload);
    };

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  return null;
}
