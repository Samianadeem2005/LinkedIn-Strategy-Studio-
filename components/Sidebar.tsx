'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  Zap,
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
  Type
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
    icon: Zap,
    subpages: [
      { href: '/', label: 'Studio Creator', icon: Zap },
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
      { href: '/settings?tab=anatomy', label: 'Post Anatomy', icon: Layers },
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
    <svg className={`w-4 h-6 flex-shrink-0 ${active ? 'text-[#c94731]' : dark ? 'text-white/40' : 'text-[#4f6e7d]/35'}`} viewBox="0 0 16 24" fill="none">
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

  // Accordion expanded state for each nav group
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    navGroups.forEach(g => {
      initial[g.href] = true;
    });
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
    setExpandedGroups(prev => ({
      ...prev,
      [href]: !prev[href]
    }));
  };

  return (
    <aside
      className={`relative ${collapsed ? 'w-20 z-50 overflow-visible' : 'w-60 z-30'
        } flex-shrink-0 flex flex-col border-r h-screen sticky top-0 transition-all duration-300 ease-out select-none bg-[#f5f1f2] border-[#4f6e7d]/20`}
    >
      {/* Header / Logo */}
      <div
        className={`p-4 border-b border-[#4f6e7d]/15 flex items-center ${collapsed ? 'flex-col gap-3 justify-center' : 'justify-between'
          }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8.5 h-8.5 rounded-xl flex items-center justify-center flex-shrink-0 bg-[#2c2c2c] text-white shadow-xs">
            <Layers size={17} className="text-[#c94731]" />
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <div className="font-bold text-sm text-[#2c2c2c] tracking-tight">
                Content <span className="font-serif-italic text-[#c94731] font-normal">OS</span>
              </div>
              <div className="text-[11px] text-[#4f6e7d]">
                LinkedIn Workspace
              </div>
            </div>
          )}
        </div>

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-7 h-7 rounded-full border border-[#4f6e7d]/25 text-[#4f6e7d] hover:text-[#2c2c2c] hover:bg-white transition-all duration-200 flex items-center justify-center flex-shrink-0 cursor-pointer shadow-xs"
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
                    className={`flex items-center justify-between px-3 py-2 rounded-xl transition-all duration-150 cursor-pointer group ${
                      groupActive
                        ? 'bg-white text-[#2c2c2c] shadow-2xs border border-[#4f6e7d]/20 font-bold'
                        : 'text-[#2c2c2c] hover:bg-white/70 hover:text-[#2c2c2c]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${groupActive ? 'bg-[#2c2c2c] text-white shadow-xs' : 'bg-[#4f6e7d]/10 text-[#4f6e7d]'}`}>
                        <Icon size={15} />
                      </div>
                      <span className="text-xs font-bold tracking-tight truncate">{group.label}</span>
                    </div>

                    <ChevronDown
                      size={13}
                      className={`text-[#4f6e7d] transition-transform duration-200 ${isExpanded ? 'rotate-180 text-[#2c2c2c]' : ''}`}
                    />
                  </div>
                ) : (
                  <Link
                    href={group.href}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all duration-150 cursor-pointer ${
                      groupActive
                        ? 'bg-[#2c2c2c] text-white shadow-sm font-bold'
                        : 'text-[#2c2c2c] hover:bg-white/70 hover:text-[#2c2c2c]'
                    }`}
                  >
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${groupActive ? 'bg-white/15 text-white' : 'bg-[#4f6e7d]/10 text-[#4f6e7d]'}`}>
                      <Icon size={15} />
                    </div>
                    <span className="text-xs font-bold tracking-tight truncate">{group.label}</span>
                  </Link>
                )
              ) : (
                /* Collapsed Icon Only Button */
                <Link
                  href={group.href}
                  className={`w-12 h-12 mx-auto rounded-2xl flex items-center justify-center transition-all duration-150 cursor-pointer ${
                    groupActive
                      ? 'bg-[#2c2c2c] text-white shadow-md'
                      : 'bg-white/60 text-[#4f6e7d] hover:bg-white hover:text-[#2c2c2c] border border-[#4f6e7d]/15'
                  }`}
                >
                  <Icon size={18} />
                </Link>
              )}

              {/* Subpages Tree View when Sidebar is Expanded */}
              {!collapsed && hasSubpages && isExpanded && (
                <div className="ml-4 pl-2 border-l-2 border-[#4f6e7d]/20 py-1 space-y-1 my-1">
                  {group.subpages!.map((sub) => {
                    const active = isSubActive(sub.href);
                    return (
                      <div key={sub.href} className="flex items-center gap-1">
                        <TreeElbow active={active} />
                        <Link
                          href={sub.href}
                          className={`flex-1 flex items-center justify-between px-3 py-1.5 rounded-xl text-xs transition-all cursor-pointer ${
                            active
                              ? 'bg-[#2c2c2c] text-white font-semibold shadow-sm'
                              : 'text-[#4f6e7d] hover:bg-white hover:text-[#2c2c2c] font-medium'
                          }`}
                        >
                          <span className="truncate">{sub.label}</span>
                          {active && <ChevronRight size={12} className="text-white flex-shrink-0 ml-1" />}
                        </Link>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Floating Tree Popover when Sidebar is Collapsed */}
              {collapsed && isFlyoutOpen && (
                <div
                  onMouseEnter={() => {
                    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
                  }}
                  onMouseLeave={handleMouseLeave}
                  className="absolute left-full top-0 pl-2.5 z-50 flex flex-col items-start space-y-2 animate-fade-in"
                >
                  {/* Floating Header Label Pill */}
                  <div className="px-3 py-1.5 rounded-xl bg-[#2c2c2c] text-white text-xs font-bold flex items-center gap-2 shadow-md border border-[#4f6e7d]/30 whitespace-nowrap">
                    <Icon size={14} className="text-[#c94731]" />
                    <span>{group.label}</span>
                  </div>

                  {/* Subpage Tree Card with Elbow Connectors */}
                  {hasSubpages && (
                    <div className="w-52 bg-[#2c2c2c] border border-[#4f6e7d]/30 text-white rounded-2xl p-3 shadow-2xl space-y-1.5 backdrop-blur-md">
                      <div className="ml-1 pl-2 border-l-2 border-[#4f6e7d]/40 space-y-1">
                        {group.subpages!.map((sub) => {
                          const active = isSubActive(sub.href);
                          return (
                            <div key={sub.href} className="flex items-center gap-1.5">
                              <TreeElbow active={active} dark />
                              <Link
                                href={sub.href}
                                onClick={() => setActiveFlyout(null)}
                                className={`flex-1 flex items-center justify-between px-3 py-1.5 rounded-xl text-xs transition-all cursor-pointer ${
                                  active
                                    ? 'bg-white/15 border border-white/20 text-white font-bold shadow-xs'
                                    : 'text-white/70 hover:bg-white/10 hover:text-white font-medium'
                                }`}
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

      {/* Generation Status Footer (Quiet Precision removed) */}
      {generating && (
        <div className="p-3 border-t border-[#4f6e7d]/15">
          <div className="w-full flex items-center justify-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-[#c94731]/10 text-[#c94731] border border-[#c94731]/30 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-[#c94731] animate-ping" />
            {!collapsed ? (webSearchStatus || 'Generating...') : '...'}
          </div>
        </div>
      )}
    </aside>
  );
}
