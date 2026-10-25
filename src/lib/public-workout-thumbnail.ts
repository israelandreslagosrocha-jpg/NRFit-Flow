import { FREE_WORKOUTS } from './public-social.ts';

const IMAGE_TYPES = new Set(['image/jpeg', 'image/webp', 'image/avif', 'image/png']);
const MAX_BYTES = 2 * 1024 * 1024;

/** Sólo dos IDs públicos y un host fijo; nunca aceptar URLs, cookies ni tokens del navegador. */
export async function publicWorkoutThumbnail(id: string, requestUrl: string, fetchImage: typeof fetch = fetch) {
  const video = FREE_WORKOUTS.find((item) => item.id === id);
  if (!video) return new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });

  for (const size of ['maxresdefault', 'hqdefault']) {
    try {
      const image = await fetchImage(`https://i.ytimg.com/vi/${video.id}/${size}.jpg`, {
        cache: 'no-store',
        redirect: 'error',
        signal: AbortSignal.timeout(4000),
      });
      const type = image.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
      if (!image.ok || !type || !IMAGE_TYPES.has(type)) continue;
      if (Number(image.headers.get('content-length')) > MAX_BYTES) continue;
      const bytes = await image.arrayBuffer();
      if (!bytes.byteLength || bytes.byteLength > MAX_BYTES) continue;
      return new Response(bytes, {
        headers: {
          'Content-Type': type,
          'Cache-Control': 'public, max-age=300, s-maxage=900',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    } catch {
      // La portada no debe impedir ver la página si YouTube falla o agota el tiempo.
    }
  }

  return new Response(null, {
    status: 307,
    headers: {
      Location: new URL(video.thumbnail, requestUrl).href,
      'Cache-Control': 'public, max-age=60, s-maxage=60',
    },
  });
}
