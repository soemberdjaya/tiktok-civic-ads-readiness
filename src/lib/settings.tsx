import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { DEFAULT_SETTINGS, getSettings, saveSettings, type Settings } from '../store/db';
import { readKey } from '../store/keys';
import { getProvider } from '../providers';
import type { ProviderAdapter, ProviderConfig } from '../providers/types';

interface SettingsValue {
  settings: Settings;
  provider: ProviderAdapter;
  config: ProviderConfig;
  hasKey: boolean;
  update: (patch: Partial<Settings>) => Promise<void>;
  /** Re-read the key after it is saved in Settings. */
  refresh: () => Promise<void>;
}

const Ctx = createContext<SettingsValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [keyVersion, setKeyVersion] = useState(0);

  const refresh = useCallback(async () => {
    setSettings(await getSettings());
    setKeyVersion((v) => v + 1);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<SettingsValue>(() => {
    const provider = getProvider(settings.provider);
    const key = readKey(settings.provider);
    const config: ProviderConfig = {
      key,
      model: settings.models[settings.provider] || provider.defaultModel,
      baseUrl: settings.baseUrl,
    };
    return {
      settings,
      provider,
      config,
      // Local endpoints (Ollama) may run without a key.
      hasKey: !!key || provider.id === 'custom',
      update: async (patch) => setSettings(await saveSettings(patch)),
      refresh,
    };
    // keyVersion forces the key to be re-read from storage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, keyVersion, refresh]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSettings(): SettingsValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSettings used outside SettingsProvider');
  return v;
}
