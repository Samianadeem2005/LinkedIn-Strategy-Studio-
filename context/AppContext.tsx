'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

export interface PostType {
  id: string;
  name: string;
  dos: string[];
  donts: string[];
  core_focus: string;
}

export interface AnatomySection {
  id: string;
  section_name: string;
  rule_description: string;
  order_index: number;
  applies_to_post_type_id: string | null;
}

export interface ToneProfile {
  formality: 'casual' | 'professional' | 'mixed';
  sentenceLength: 'short' | 'medium' | 'long';
  bannedPhrases: string[];
  languageMix: string;
}

export interface Settings {
  id: number;
  frequency: string;
  tone_profile: ToneProfile;
  anatomy_scope: 'global' | 'per_post_type';
}

export interface WeeklyMapping {
  day_of_week: string;
  post_type_id: string | null;
  post_type_name: string | null;
  series_length: number;
  is_continuation_of: string | null;
}

interface AppContextType {
  postTypes: PostType[];
  anatomy: AnatomySection[];
  settings: Settings | null;
  weeklyMapping: WeeklyMapping[];
  loading: boolean;
  refreshPostTypes: () => Promise<void>;
  refreshAnatomy: () => Promise<void>;
  refreshSettings: () => Promise<void>;
  refreshWeeklyMapping: () => Promise<void>;
  refreshAll: () => Promise<void>;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [postTypes, setPostTypes] = useState<PostType[]>([]);
  const [anatomy, setAnatomy] = useState<AnatomySection[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [weeklyMapping, setWeeklyMapping] = useState<WeeklyMapping[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshPostTypes = useCallback(async () => {
    const res = await fetch('/api/post-types');
    if (res.ok) setPostTypes(await res.json());
  }, []);

  const refreshAnatomy = useCallback(async () => {
    const res = await fetch('/api/anatomy');
    if (res.ok) setAnatomy(await res.json());
  }, []);

  const refreshSettings = useCallback(async () => {
    const res = await fetch('/api/settings');
    if (res.ok) setSettings(await res.json());
  }, []);

  const refreshWeeklyMapping = useCallback(async () => {
    const res = await fetch('/api/weekly-mapping');
    if (res.ok) setWeeklyMapping(await res.json());
  }, []);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([refreshPostTypes(), refreshAnatomy(), refreshSettings(), refreshWeeklyMapping()]);
    setLoading(false);
  }, [refreshPostTypes, refreshAnatomy, refreshSettings, refreshWeeklyMapping]);

  useEffect(() => {
    refreshAll();

    const handleStrategyUpdated = () => {
      refreshAll();
    };

    window.addEventListener('strategy_updated', handleStrategyUpdated);
    return () => {
      window.removeEventListener('strategy_updated', handleStrategyUpdated);
    };
  }, [refreshAll]);

  return (
    <AppContext.Provider value={{ postTypes, anatomy, settings, weeklyMapping, loading, refreshPostTypes, refreshAnatomy, refreshSettings, refreshWeeklyMapping, refreshAll }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
