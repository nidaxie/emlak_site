import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Emlak Platformu',
  description: 'Gayrimenkul ilan platformu',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="tr">
      <body className="bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
