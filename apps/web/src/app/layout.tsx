import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import '../styles/tokens.css';
import '../styles/globals.css';

export const metadata: Metadata = {
  title: 'Tripwire — Account Intelligence Brief',
  description:
    'Per-account buying-signal radar: versioned dossiers, string-verified quotes, and trigger alerts for named-account sales teams.',
};

export default function RootLayout({ children }: { readonly children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
