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
  title: 'VeloPulse Pro | Fitness Telemetry',
  description: 'Advanced real-time cycling and fitness dashboard',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${inter.variable} ${jetBrainsMono.variable} bg-hw-bg text-white min-h-screen antialiased`}>
        {children}
      </body>
    </html>
  );
}
