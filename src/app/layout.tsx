import type { Metadata, Viewport } from 'next';
import { Providers } from '@/components/layout/Providers';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Shiora on Aethelred',
    template: '%s | Shiora',
  },
  description:
    "Women's Health AI Platform on the Aethelred Blockchain — TEE-verified privacy for sensitive health data.",
  metadataBase: new URL('https://shiora.health'),
  icons: {
    icon: '/favicon.svg',
  },
  manifest: '/site.webmanifest',
  openGraph: {
    title: 'Shiora on Aethelred',
    description:
      "Women's Health AI Platform on the Aethelred Blockchain",
    siteName: 'Shiora on Aethelred',
    images: [{ url: '/og-image.svg', width: 1200, height: 630 }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Shiora on Aethelred',
    description:
      "Women's Health AI Platform on the Aethelred Blockchain",
    images: ['/og-image.svg'],
  },
};

export const viewport: Viewport = {
  themeColor: '#8B1538',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-surface-50 text-slate-800 antialiased font-sans min-h-screen flex flex-col">
        <Providers>
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-brand-500 focus:text-white focus:rounded-lg focus:text-sm focus:font-medium"
          >
            Skip to main content
          </a>
          {children}
        </Providers>
      </body>
    </html>
  );
}
