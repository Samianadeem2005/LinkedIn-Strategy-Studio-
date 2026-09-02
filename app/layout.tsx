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
      <body className="bg-[#F8F7FA] text-[#2C2C2C] antialiased selection:bg-[#A78BE0]/20 selection:text-[#2C2C2C] font-sans relative">
        {/* Strong, soft background blur element: soft purple & light teal diffused abstract shapes */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
          {/* Soft purple hazy glow */}
          <div
            className="absolute -bottom-40 -left-40 w-[750px] h-[750px] rounded-full blur-[160px]"
            style={{ background: 'radial-gradient(circle at 35% 65%, rgba(187,178,245,0.38) 0%, rgba(167,139,224,0.22) 45%, transparent 70%)' }}
          />
          {/* Soft light teal hazy glow */}
          <div
            className="absolute -top-32 -right-32 w-[650px] h-[650px] rounded-full blur-[150px]"
            style={{ background: 'radial-gradient(circle at 60% 30%, rgba(153,230,230,0.30) 0%, rgba(128,229,217,0.18) 50%, transparent 70%)' }}
          />
          {/* Subtle soft chartreuse accent glow */}
          <div
            className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full blur-[140px]"
            style={{ background: 'radial-gradient(circle, rgba(214,236,114,0.18) 0%, transparent 65%)' }}
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
