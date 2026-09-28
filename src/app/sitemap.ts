import type { MetadataRoute } from 'next';

const origin = 'https://natyentrenadora.com';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: origin, lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: `${origin}/terminos`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    { url: `${origin}/privacidad`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    { url: `${origin}/cookies`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.2 },
    { url: `${origin}/cancelacion`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
  ];
}
