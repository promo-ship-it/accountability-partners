import type { Metadata, Viewport } from 'next';
import { brand } from '@/lib/brand';
import './globals.css';

export const metadata: Metadata = {
  title: `${brand.name} — ${brand.tagline}`,
  description:
    'An AI accountability partner that understands your barriers, holds you accountable, and helps you build the discipline to achieve the goals that matter.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#4f46e5',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
