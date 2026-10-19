// useCompanyName() + useAppLogo("restaurant_app") for the auth screens: business settings
// (cached in storage, fetched once per launch). Logo order as on web: settings.restaurantLogo,
// settings.logo, then the app-config logoUrl; callers fall back to the bundled logo.png.
import { useEffect, useState } from "react";
import { getBusinessSettings } from "../../api/content";
import { resolveMediaUrl } from "../ui";
import { KEYS, store } from "../../storage";
import { useTheme } from "../../theme/ThemeContext";

let settingsPromise = null;
let cachedSettings = null;

function loadSettings() {
  if (cachedSettings) return Promise.resolve(cachedSettings);
  if (!settingsPromise) {
    settingsPromise = getBusinessSettings()
      .then((res) => {
        const data = res?.data && typeof res.data === "object" ? res.data : null;
        if (data) {
          cachedSettings = data;
          store.set(KEYS.businessSettings, data);
        }
        return data;
      })
      .catch(() => null)
      .finally(() => {
        settingsPromise = null;
      });
  }
  return settingsPromise;
}

export function useBranding() {
  const { logoUrl } = useTheme();
  const [settings, setSettings] = useState(cachedSettings);

  useEffect(() => {
    let cancelled = false;
    if (!cachedSettings) {
      store.get(KEYS.businessSettings).then((stored) => {
        if (!cancelled && stored && !cachedSettings) setSettings(stored);
      });
    }
    loadSettings().then((data) => {
      if (!cancelled && data) setSettings(data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const companyName = String(settings?.companyName || "").trim() || "CityFood";
  const logo = resolveMediaUrl(settings?.restaurantLogo?.url || settings?.logo?.url || logoUrl || null);
  return { companyName, logo };
}
