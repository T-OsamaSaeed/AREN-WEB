import './globals.css';
import PwaRegister from '../../components/PwaRegister';

export const metadata = {
  title: 'Aren Academy Teacher',
  description: 'Aren Academy teacher dashboard',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'Aren Academy',
    statusBarStyle: 'default',
  },
  icons: {
    icon: [
      { url: '/favicon.png', sizes: '32x32', type: 'image/png' },
      { url: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
};

export const viewport = {
  themeColor: '#112a57',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }) {
  return (
    <html lang="tr">
      <body>
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
