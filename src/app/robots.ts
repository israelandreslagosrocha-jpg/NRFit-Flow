import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin/', '/para-ti/', '/checkout/', '/auth/'],
    },
    sitemap: 'https://natyentrenadora.com/sitemap.xml',
  };
}
