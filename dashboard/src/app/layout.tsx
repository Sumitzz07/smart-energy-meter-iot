import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers/Providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Smart Energy Meter — IoT Monitoring Platform',
  description: 'Real-time IoT energy monitoring, protection and telemetry analytics platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          <div style={{ display: 'flex', minHeight: '100vh', flexDirection: 'column' }}>
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}
