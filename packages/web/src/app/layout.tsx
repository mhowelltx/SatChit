import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SatChit',
  description: 'Explore AI-generated worlds of your making.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
