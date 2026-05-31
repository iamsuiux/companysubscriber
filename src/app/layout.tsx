import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Company Subscribe',
  description: 'Monitor company career pages for new job postings',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 antialiased">{children}</body>
    </html>
  );
}
