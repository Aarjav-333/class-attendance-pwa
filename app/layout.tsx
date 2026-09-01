import type { Metadata, Viewport } from 'next';

import './globals.css';
import { ServiceWorkerRegistrar } from '@/components/ServiceWorkerRegistrar';
import { OfflineBanner } from '@/components/States';
import { ToastProvider } from '@/components/Toast';
import { APP_LONG_NAME, APP_NAME } from '@/lib/constants';

export const metadata: Metadata = {
  title: {
    default: `${APP_NAME} - Mark class attendance fast`,
    template: `%s - ${APP_NAME}`,
  },
  description:
    'Mark, review and export class attendance in seconds. Installable on iPhone from Safari.',
  applicationName: APP_LONG_NAME,
  manifest: '/manifest.webmanifest',
  formatDetection: { telephone: false, date: false, address: false, email: false },
  appleWebApp: {
    capable: true,
    title: APP_NAME,
    // "default" keeps the iOS status bar legible against the app background.
    statusBarStyle: 'default',
  },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  other: {
    // Legacy iOS flag - still read by older Safari versions.
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  // Required for env(safe-area-inset-*) to report real values on iPhone.
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f4f5f8' },
    { media: '(prefers-color-scheme: dark)', color: '#0c0e12' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="app-shell bg-bg text-fg">
        <ToastProvider>
          <OfflineBanner />
          {children}
        </ToastProvider>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
