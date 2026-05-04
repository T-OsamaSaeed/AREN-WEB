export default function manifest() {
  return {
    name: 'Aren Academy Teacher',
    short_name: 'Aren Academy',
    description: 'Aren Academy teacher dashboard',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#112a57',
    icons: [
      {
        src: '/pwa-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any maskable',
      },
      {
        src: '/pwa-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any maskable',
      },
    ],
  };
}
