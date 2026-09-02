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
      <body className="bg-[#E4E1E8] text-[#2C2C2C] antialiased selection:bg-[#A78BE0]/20 selection:text-[#2C2C2C] font-sans relative">
        {/* Ambient lavender glow — bottom-left and faint top-right */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
          <div
            className="absolute -bottom-40 -left-40 w-[650px] h-[650px] rounded-full blur-[140px]"
            style={{ background: 'radial-gradient(circle at 30% 70%, rgba(187,178,245,0.30) 0%, rgba(201,190,240,0.18) 35%, transparent 65%)' }}
          />
          <div
            className="absolute -top-32 -right-32 w-[450px] h-[450px] rounded-full blur-[120px]"
            style={{ background: 'rgba(214,236,114,0.10)' }}
          />
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
