'use client';
import { useEffect } from 'react';
import { consumeTrialStarted, emitConversion } from '../../lib/analytics-client';
export default function TrialConfirmation({ isTrial }: { isTrial: boolean }) {
  useEffect(() => {
    const confirm = () => {
      if (isTrial && consumeTrialStarted()) emitConversion({ event: 'trial_started' });
    };
    // Root Analytics needs a hydration pass before it can receive this event.
    window.addEventListener('naty:analytics-ready', confirm);
    return () => window.removeEventListener('naty:analytics-ready', confirm);
  }, [isTrial]);
  return null;
}
