import { useEffect, useState } from "react"
import { adminAPI } from "@food/api"

/**
 * Global "HQ pays restaurants & delivery partners" toggle (Toggle Management).
 * While it is on, franchise owners do not see the restaurant / rider payout pages.
 */
const STORAGE_KEY = "hq_pays_partners"
const EVENT = "hqPaysPartnersChanged"

export function getHqPaysPartners() {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1"
  } catch {
    return false
  }
}

export function setHqPaysPartners(value) {
  try {
    localStorage.setItem(STORAGE_KEY, value ? "1" : "0")
  } catch {
    // ignore
  }
  window.dispatchEvent(new CustomEvent(EVENT))
}

let refreshing = null

/** Reads the current value from the server once per page load. */
export function refreshHqPaysPartners() {
  if (!refreshing) {
    refreshing = adminAPI
      .getBusinessSettings()
      .then((res) => {
        const settings = res?.data?.data || res?.data
        if (settings) setHqPaysPartners(Boolean(settings.hqPaysPartners))
      })
      .catch(() => {
        refreshing = null
      })
  }
  return refreshing
}

export function useHqPaysPartners({ refresh = false } = {}) {
  const [value, setValue] = useState(getHqPaysPartners)
  useEffect(() => {
    const onChange = () => setValue(getHqPaysPartners())
    window.addEventListener(EVENT, onChange)
    if (refresh) refreshHqPaysPartners()
    return () => window.removeEventListener(EVENT, onChange)
  }, [refresh])
  return value
}
