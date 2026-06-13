import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
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
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${inter.variable} ${jetBrainsMono.variable} min-h-dvh bg-vp-bg text-vp-text antialiased`}>
        {children}
      </body>
    </html>
  );
}
