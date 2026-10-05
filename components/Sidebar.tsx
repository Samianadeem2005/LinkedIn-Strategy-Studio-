'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  Settings,
  LayoutGrid,
  Calendar,
  Layers,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Sparkles,
  Bookmark,
  FileText,
  Type,
  Compass
} from 'lucide-react';
import { useApp } from '@/context/AppContext';

export interface NavFlyoutItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

export interface NavGroupItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  subpages?: NavFlyoutItem[];
}

const navGroups: NavGroupItem[] = [
  {
    href: '/',
    label: 'Studio',
    icon: Sparkles,
    subpages: [
      { href: '/', label: 'Studio Creator', icon: Sparkles },
      { href: '/formatter', label: 'Text Formatter', icon: Type },
    ],
  },
  {
    href: '/drafts',
    label: 'Saved Drafts',
    icon: FileText,
  },
  {
    href: '/calendar',
    label: 'Calendar',
    icon: Calendar,
    subpages: [
      { href: '/calendar', label: 'Content Calendar', icon: Calendar },
      { href: '/calendar-maker', label: 'Schedule Builder', icon: Sparkles },
    ],
  },
  {
    href: '/strategy',
    label: 'Strategy',
    icon: LayoutGrid,
    subpages: [
      { href: '/strategy', label: 'Weekly Pillars', icon: LayoutGrid },
      { href: '/settings?tab=pillars', label: 'Post Pillars', icon: LayoutGrid },
      { href: '/settings?tab=intents', label: 'Content Intents', icon: Compass },
      { href: '/settings?tab=anatomy', label: 'Post Anatomy', icon: Layers },
      { href: '/post-components', label: 'Post Components', icon: Layers },
      { href: '/hook-types', label: 'Hook Bank', icon: Bookmark },
      { href: '/ingest', label: 'Strategy Ingest', icon: Layers },
    ],
  },
  {
    href: '/settings',
    label: 'Settings',
    icon: Settings,
    subpages: [
      { href: '/settings?tab=about', label: 'About Me Context', icon: Bookmark },
      { href: '/settings?tab=tone', label: 'Tone & Voice', icon: Sparkles },
      { href: '/settings?tab=mechanics', label: 'Writing Mechanics', icon: Type },
    ],
  },
];

function TreeElbow({ active, dark }: { active?: boolean; dark?: boolean }) {
  return (
    <svg className={`w-4 h-6 flex-shrink-0 ${active ? 'text-[#A78BE0]' : dark ? 'text-white/40' : 'text-[#8B8A93]/35'}`} viewBox="0 0 16 24" fill="none">
      <path
        d="M 2 0 L 2 12 Q 2 18 8 18 L 16 18"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const [currentTab, setCurrentTab] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [activeFlyout, setActiveFlyout] = useState<string | null>(null);
  const { generating, webSearchStatus } = useApp();

  useEffect(() => {
    const syncTab = () => {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        setCurrentTab(params.get('tab'));
      }
    };
    syncTab();
    window.addEventListener('popstate', syncTab);
    return () => window.removeEventListener('popstate', syncTab);
  }, [pathname]);

  const isSubActive = (subHref: string) => {
    if (subHref.includes('?')) {
      const [basePath, searchStr] = subHref.split('?');
      if (pathname !== basePath) return false;
      const urlParams = new URLSearchParams(searchStr);
      const targetTab = urlParams.get('tab');
      if (!currentTab && targetTab === 'about') return true;
      return currentTab === targetTab;
    }
    return pathname === subHref;
  };

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    navGroups.forEach(g => { initial[g.href] = true; });
    return initial;
  });

  useEffect(() => {
    setExpandedGroups(prev => {
      const next = { ...prev };
      navGroups.forEach(g => {
        if (g.subpages?.some(s => isSubActive(s.href))) {
          next[g.href] = true;
        }
      });
      return next;
    });
  }, [pathname, currentTab]);

  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = (href: string) => {
    if (!collapsed) return;
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setActiveFlyout(href);
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    closeTimeoutRef.current = setTimeout(() => {
      setActiveFlyout(null);
    }, 250);
  };

  const toggleGroupExpand = (href: string) => {
    setExpandedGroups(prev => ({ ...prev, [href]: !prev[href] }));
  };

  return (
    <aside
      className={`relative ${collapsed ? 'w-20 z-50 overflow-visible' : 'w-60 z-30'
        } flex-shrink-0 flex flex-col border-r h-screen sticky top-0 transition-all duration-300 ease-out select-none`}
      style={{ background: '#E4E1E8', borderColor: 'rgba(167,139,224,0.18)' }}
    >
      {/* Header / Logo */}
      <div
        className={`p-4 border-b flex items-center ${collapsed ? 'flex-col gap-3 justify-center' : 'justify-between'}`}
        style={{ borderColor: 'rgba(167,139,224,0.14)' }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm"
            style={{ background: '#1A1A1D' }}>
            <Layers size={16} className="text-[#A78BE0]" />
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <div className="font-bold text-sm tracking-tight" style={{ color: '#1C1C1E' }}>
                Content <span className="font-serif-italic font-normal" style={{ color: '#A78BE0' }}>OS</span>
              </div>
              <div className="text-[11px]" style={{ color: '#8B8A93' }}>
                LinkedIn Workspace
              </div>
            </div>
          )}
        </div>

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 cursor-pointer transition-all duration-200"
          style={{ border: '1px solid rgba(167,139,224,0.25)', color: '#8B8A93', background: '#FFFFFF' }}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
        </button>
      </div>

      {/* Navigation List */}
      <nav className={`flex-1 p-3 space-y-2 ${collapsed ? 'overflow-visible' : 'overflow-y-auto'}`}>
        {navGroups.map((group) => {
          const Icon = group.icon;
          const hasSubpages = group.subpages && group.subpages.length > 0;
          const groupActive = hasSubpages
            ? group.subpages!.some(sub => isSubActive(sub.href))
            : pathname === group.href;
          const isExpanded = expandedGroups[group.href] ?? true;
          const isFlyoutOpen = activeFlyout === group.href;

          return (
            <div
              key={group.href}
              className="relative"
              onMouseEnter={() => handleMouseEnter(group.href)}
              onMouseLeave={handleMouseLeave}
            >
              {/* Parent Navigation Item */}
              {!collapsed ? (
                hasSubpages ? (
                  <div
                    onClick={() => toggleGroupExpand(group.href)}
                    className="flex items-center justify-between px-3 py-2 rounded-xl transition-all duration-150 cursor-pointer"
                    style={{
                      background: groupActive ? '#FFFFFF' : 'transparent',
                      color: '#1C1C1E',
                      boxShadow: groupActive ? '0 2px 12px rgba(100,80,160,0.08)' : 'none',
                      border: groupActive ? '1px solid rgba(167,139,224,0.20)' : '1px solid transparent',
                    }}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                        style={{
                          background: groupActive ? '#1A1A1D' : 'rgba(167,139,224,0.12)',
                          color: groupActive ? '#FFFFFF' : '#A78BE0',
                        }}>
                        <Icon size={15} />
                      </div>
                      <span className="text-xs font-bold tracking-tight truncate" style={{ color: '#1C1C1E' }}>{group.label}</span>
                    </div>
                    <ChevronDown
                      size={13}
                      className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                      style={{ color: '#8B8A93' }}
                    />
                  </div>
                ) : (
                  <Link
                    href={group.href}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all duration-150 cursor-pointer"
                    style={{
                      background: groupActive ? '#1A1A1D' : 'transparent',
                      color: groupActive ? '#FFFFFF' : '#1C1C1E',
                    }}
                  >
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                      style={{
                        background: groupActive ? 'rgba(255,255,255,0.15)' : 'rgba(167,139,224,0.12)',
                        color: groupActive ? '#FFFFFF' : '#A78BE0',
                      }}>
                      <Icon size={15} />
                    </div>
                    <span className="text-xs font-bold tracking-tight truncate">{group.label}</span>
                  </Link>
                )
              ) : (
                <Link
                  href={group.href}
                  className="w-12 h-12 mx-auto rounded-2xl flex items-center justify-center transition-all duration-150 cursor-pointer"
                  style={{
                    background: groupActive ? '#1A1A1D' : '#FFFFFF',
                    color: groupActive ? '#FFFFFF' : '#A78BE0',
                    boxShadow: groupActive ? '0 4px 16px rgba(26,26,29,0.25)' : '0 2px 8px rgba(100,80,160,0.08)',
                    border: groupActive ? 'none' : '1px solid rgba(167,139,224,0.15)',
                  }}
                >
                  <Icon size={18} />
                </Link>
              )}

              {/* Subpages Tree View */}
              {!collapsed && hasSubpages && isExpanded && (
                <div className="ml-4 pl-2 py-1 space-y-1 my-1"
                  style={{ borderLeft: '2px solid rgba(167,139,224,0.20)' }}>
                  {group.subpages!.map((sub) => {
                    const active = isSubActive(sub.href);
                    return (
                      <div key={sub.href} className="flex items-center gap-1">
                        <TreeElbow active={active} />
                        <Link
                          href={sub.href}
                          className="flex-1 flex items-center justify-between px-3 py-1.5 rounded-xl text-xs transition-all cursor-pointer"
                          style={{
                            background: active ? '#1A1A1D' : 'transparent',
                            color: active ? '#FFFFFF' : '#8B8A93',
                            fontWeight: active ? 600 : 500,
                          }}
                        >
                          <span className="truncate">{sub.label}</span>
                          {active && <ChevronRight size={12} className="text-white flex-shrink-0 ml-1" />}
                        </Link>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Collapsed Flyout Popover */}
              {collapsed && isFlyoutOpen && (
                <div
                  onMouseEnter={() => { if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current); }}
                  onMouseLeave={handleMouseLeave}
                  className="absolute left-full top-0 pl-2.5 z-50 flex flex-col items-start space-y-2 animate-fade-in"
                >
                  <div className="px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-md whitespace-nowrap"
                    style={{ background: '#1A1A1D', color: '#FFFFFF', border: '1px solid rgba(167,139,224,0.25)' }}>
                    <Icon size={14} className="text-[#A78BE0]" />
                    <span>{group.label}</span>
                  </div>

                  {hasSubpages && (
                    <div className="w-52 rounded-2xl p-3 shadow-2xl space-y-1.5"
                      style={{ background: '#1A1A1D', border: '1px solid rgba(167,139,224,0.25)', color: '#FFFFFF' }}>
                      <div className="ml-1 pl-2 space-y-1" style={{ borderLeft: '2px solid rgba(167,139,224,0.35)' }}>
                        {group.subpages!.map((sub) => {
                          const active = isSubActive(sub.href);
                          return (
                            <div key={sub.href} className="flex items-center gap-1.5">
                              <TreeElbow active={active} dark />
                              <Link
                                href={sub.href}
                                onClick={() => setActiveFlyout(null)}
                                className="flex-1 flex items-center justify-between px-3 py-1.5 rounded-xl text-xs transition-all cursor-pointer"
                                style={{
                                  background: active ? 'rgba(255,255,255,0.12)' : 'transparent',
                                  color: active ? '#FFFFFF' : 'rgba(255,255,255,0.65)',
                                  border: active ? '1px solid rgba(255,255,255,0.18)' : '1px solid transparent',
                                  fontWeight: active ? 700 : 500,
                                }}
                              >
                                <span className="truncate">{sub.label}</span>
                                {active && <ChevronRight size={12} className="text-white flex-shrink-0 ml-1" />}
                              </Link>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
