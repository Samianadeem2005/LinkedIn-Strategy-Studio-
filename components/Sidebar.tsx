'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Zap, Settings, LayoutGrid, Calendar, Layers, ChevronLeft, ChevronRight, Sparkles, Bookmark, FileText } from 'lucide-react';
import { useApp } from '@/context/AppContext';

const navItems = [
  { href: '/', icon: Zap, label: 'Studio', desc: 'Daily post generation' },
  { href: '/calendar', icon: Calendar, label: 'Calendar', desc: 'Monthly schedule & plan' },
  { href: '/calendar-maker', icon: Sparkles, label: 'Calendar Maker', desc: 'AI content schedule generator' },
  { href: '/drafts', icon: FileText, label: 'Drafts', desc: 'Saved draft posts' },
  { href: '/ingest', icon: Layers, label: 'Ingest', desc: 'Extract raw strategy' },
  { href: '/hook-types', icon: Bookmark, label: 'Hook Types', desc: 'Structured hook bank & angles' },
  { href: '/settings', icon: Settings, label: 'Settings', desc: 'Post types & anatomy' },
  { href: '/strategy', icon: LayoutGrid, label: 'Strategy', desc: 'Weekly template & rules' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const { generating, webSearchStatus } = useApp();

  return (
    <aside
      className={`${
        collapsed ? 'w-20' : 'w-60'
      } flex-shrink-0 flex flex-col border-r h-screen sticky top-0 transition-all duration-300 ease-in-out z-20`}
      style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}
    >
      {/* Logo & Toggle */}
      <div
        className={`p-4 border-b flex items-center ${
          collapsed ? 'flex-col gap-3 justify-center' : 'justify-between'
        }`}
        style={{ borderColor: 'var(--border)' }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, var(--accent), #a78bfa)' }}
          >
            <Layers size={16} className="text-white" />
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                Content OS
              </div>
              <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                LinkedIn · Personal
              </div>
            </div>
          )}
        </div>

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-lg border transition-colors hover:bg-white/5 flex-shrink-0"
          style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map(({ href, icon: Icon, label, desc }) => {
          const active = href === '/' ? pathname === '/' : pathname === href || (href !== '/' && pathname.startsWith(href + '/'));
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? `${label} — ${desc}` : undefined}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 group ${
                collapsed ? 'justify-center' : ''
              }`}
              style={{
                background: active ? 'var(--accent-glow)' : 'transparent',
                border: `1px solid ${active ? 'var(--accent)' : 'transparent'}`,
              }}
            >
              <Icon
                size={18}
                style={{ color: active ? 'var(--accent)' : 'var(--text-secondary)' }}
                className="group-hover:text-accent transition-colors flex-shrink-0"
              />
              {!collapsed && (
                <div className="min-w-0 flex-1">
                  <div
                    className="text-sm font-medium leading-tight truncate"
                    style={{ color: active ? 'var(--accent)' : 'var(--text-primary)' }}
                  >
                    {label}
                  </div>
                  <div className="text-xs leading-tight truncate" style={{ color: 'var(--text-muted)' }}>
                    {desc}
                  </div>
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t flex flex-col items-center justify-center text-center gap-2" style={{ borderColor: 'var(--border)' }}>
        {generating && (
          <div className="w-full flex items-center justify-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold animate-pulse"
            style={{ background: 'rgba(124, 58, 237, 0.15)', color: 'var(--accent)', border: '1px solid var(--accent)' }}>
            <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping" />
            {!collapsed ? (webSearchStatus || 'Generating post...') : '...'}
          </div>
        )}

        {!collapsed ? (
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Powered by Gemini · Local SQLite
          </div>
        ) : (
          <span className="text-[10px] font-bold" style={{ color: 'var(--text-muted)' }}>
            OS
          </span>
        )}
      </div>
    </aside>
  );
}
