import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getSupabasePublishableKey,
  getSupabaseSecretKey,
  getSupabaseUrl,
} from '../lib/supabase/environment.ts';

const original = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  publishable: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  anon: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  secret: process.env.SUPABASE_SECRET_KEY,
  serviceRole: process.env.SUPABASE_SERVICE_ROLE_KEY,
};

function restore(name: keyof typeof original, value: string | undefined) {
  if (value === undefined) delete process.env[name === 'url' ? 'NEXT_PUBLIC_SUPABASE_URL' : name === 'publishable' ? 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY' : name === 'anon' ? 'NEXT_PUBLIC_SUPABASE_ANON_KEY' : name === 'secret' ? 'SUPABASE_SECRET_KEY' : 'SUPABASE_SERVICE_ROLE_KEY'];
  else process.env[name === 'url' ? 'NEXT_PUBLIC_SUPABASE_URL' : name === 'publishable' ? 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY' : name === 'anon' ? 'NEXT_PUBLIC_SUPABASE_ANON_KEY' : name === 'secret' ? 'SUPABASE_SECRET_KEY' : 'SUPABASE_SERVICE_ROLE_KEY'] = value;
}

afterEach(() => {
  for (const [name, value] of Object.entries(original) as Array<[keyof typeof original, string | undefined]>) {
    restore(name, value);
  }
});

describe('Supabase API key migration', () => {
  it('prefers publishable and secret keys over legacy variables', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_current';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'legacy-anon';
    process.env.SUPABASE_SECRET_KEY = 'sb_secret_current';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'legacy-service-role';

    assert.equal(getSupabaseUrl(), 'https://project.supabase.co');
    assert.equal(getSupabasePublishableKey(), 'sb_publishable_current');
    assert.equal(getSupabaseSecretKey(), 'sb_secret_current');
  });

  it('keeps legacy variables as an explicit temporary fallback', () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    delete process.env.SUPABASE_SECRET_KEY;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'legacy-anon';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'legacy-service-role';

    assert.equal(getSupabasePublishableKey(), 'legacy-anon');
    assert.equal(getSupabaseSecretKey(), 'legacy-service-role');
  });
});
