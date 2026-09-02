import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, Newsreader } from 'next/font/google';
import './globals.css';
import { AppProvider } from '@/context/AppContext';
import Sidebar from '@/components/Sidebar';

const sans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const serif = Newsreader({
  subsets: ['latin'],
  style: ['italic'],
  variable: '--font-serif',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'LinkedIn Content OS',
  description: 'Personal content-operations tool — strategy, calendar, and drafting in one place.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable}`}>
      <body className="bg-[#f5f1f2] text-[#2c2c2c] antialiased selection:bg-[#4f6e7d]/20 selection:text-[#2c2c2c] font-sans relative">
        {/* Soft ambient blurred gradient blobs sitting behind all content */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
          <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full bg-[#4f6e7d]/12 blur-[120px]" />
          <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full bg-[#c94731]/10 blur-[120px]" />
        </div>

        <AppProvider>
          <div className="flex h-screen overflow-hidden bg-transparent">
            <Sidebar />
            <main className="flex-1 overflow-y-auto bg-transparent">
              {children}
            </main>
          </div>
        </AppProvider>
      </body>
    </html>
  );
}
