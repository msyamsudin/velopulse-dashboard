import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import PwaRegister from '../components/PwaRegister';
import '../index.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
});

export const metadata: Metadata = {
  title: 'VeloPulse | Training Cockpit',
  description: 'Indoor cycling telemetry and workout review',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'VeloPulse',
  },
};

export const viewport: Viewport = {
  themeColor: '#0a0f0e',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${inter.variable} ${jetBrainsMono.variable} min-h-dvh bg-vp-bg text-vp-text antialiased`}>
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
