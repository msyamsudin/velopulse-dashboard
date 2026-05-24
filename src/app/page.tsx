'use client';

import dynamic from 'next/dynamic';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Dynamically import the App component with SSR disabled
// This is required because of Web Bluetooth (navigator.bluetooth)
const App = dynamic(() => import('../App'), { ssr: false });

const queryClient = new QueryClient();

export default function Home() {
  return (
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  );
}

