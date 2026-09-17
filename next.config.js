/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.flow.cl https://sandbox.flow.cl https://www.flow.cl https://*.mercadopago.com https://*.mercadopago.cl https://http2.mlstatic.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com",
              "img-src 'self' data: blob: https://images.unsplash.com https://res.cloudinary.com https://*.flow.cl https://sandbox.flow.cl https://www.flow.cl https://*.mercadopago.com https://http2.mlstatic.com",
              "font-src 'self' data: https://fonts.gstatic.com https://cdnjs.cloudflare.com",
              "connect-src 'self' https://wqsmimxjnfanrenlhdgx.supabase.co wss://wqsmimxjnfanrenlhdgx.supabase.co https://*.flow.cl https://sandbox.flow.cl https://www.flow.cl https://*.mercadopago.com https://*.mercadopago.cl",
              "media-src 'self' https://res.cloudinary.com blob:",
              "frame-src 'self' https://*.flow.cl https://sandbox.flow.cl https://www.flow.cl https://*.mercadopago.com https://*.mercadopago.cl",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self' https://*.flow.cl https://sandbox.flow.cl https://www.flow.cl https://*.mercadopago.com https://*.mercadopago.cl",
              "frame-ancestors 'none'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
