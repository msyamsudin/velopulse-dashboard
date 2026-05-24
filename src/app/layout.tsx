import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import '../index.css';

const inter = Inter({ subsets: ['latin'] });

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
      <body className={`${inter.className} bg-hw-bg text-white min-h-screen antialiased`}>
        {children}
      </body>
    </html>
  );
}
