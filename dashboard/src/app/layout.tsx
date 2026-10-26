import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/components/providers/Providers';

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
      <body>
        <Providers>
          <div style={{ display: 'flex', minHeight: '100vh', flexDirection: 'column' }}>
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}
