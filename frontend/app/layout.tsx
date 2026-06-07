import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { TopNav } from '@/components/shell/TopNav';
import { TrustBar } from '@/components/shell/TrustBar';
import { ChatWidget } from '@/components/widget/ChatWidget';
import { CartDrawer } from '@/components/cart/CartDrawer';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'PartSelect — Refrigerator & Dishwasher Parts',
  description: 'Find the right refrigerator and dishwasher part, fast. Here to help since 1999.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans antialiased">
        <TopNav />
        <TrustBar />
        <main className="min-h-[60vh] pb-24">{children}</main>
        <CartDrawer />
        <ChatWidget />
      </body>
    </html>
  );
}
