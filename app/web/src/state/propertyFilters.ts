import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Port of the `FiltersChange__c` Lightning message channel: the filter criteria live in the URL
 * search params (`searchKey`, `maxPrice`, `minBedrooms`, `minBathrooms`) so a filtered view is
 * linkable, and every subscriber (PropertyTileList, PropertyListMap) re-renders through the
 * router when `propertyFilter` publishes. Params equal to the defaults are omitted from the URL.
 */
export interface PropertyFilters {
  searchKey: string;
  maxPrice: number;
  minBedrooms: number;
  minBathrooms: number;
}

/** `propertyFilter` defaults (`MAX_PRICE = 1200000`). */
export const FILTER_DEFAULTS: PropertyFilters = {
  searchKey: '',
  maxPrice: 1_200_000,
  minBedrooms: 0,
  minBathrooms: 0,
};

export const FILTER_PARAM_KEYS = ['searchKey', 'maxPrice', 'minBedrooms', 'minBathrooms'] as const;

function readNumber(params: URLSearchParams, key: string, fallback: number): number {
  const raw = params.get(key);
  if (raw === null || raw.trim() === '') {
    return fallback;
  }
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

export function readPropertyFilters(params: URLSearchParams): PropertyFilters {
  return {
    searchKey: params.get('searchKey') ?? FILTER_DEFAULTS.searchKey,
    maxPrice: readNumber(params, 'maxPrice', FILTER_DEFAULTS.maxPrice),
    minBedrooms: readNumber(params, 'minBedrooms', FILTER_DEFAULTS.minBedrooms),
    minBathrooms: readNumber(params, 'minBathrooms', FILTER_DEFAULTS.minBathrooms),
  };
}

export function writePropertyFilters(
  params: URLSearchParams,
  filters: PropertyFilters,
): URLSearchParams {
  const next = new URLSearchParams(params);
  for (const key of FILTER_PARAM_KEYS) {
    const value = filters[key];
    if (value === FILTER_DEFAULTS[key]) {
      next.delete(key);
    } else {
      next.set(key, String(value));
    }
  }
  return next;
}

export function usePropertyFilters() {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo(() => readPropertyFilters(searchParams), [searchParams]);

  /** `publish(messageContext, FILTERSCHANGEMC, filters)`. */
  const setFilters = useCallback(
    (next: PropertyFilters) => {
      setSearchParams((current) => writePropertyFilters(current, next), { replace: true });
    },
    [setSearchParams],
  );

  const resetFilters = useCallback(() => setFilters(FILTER_DEFAULTS), [setFilters]);

  return { filters, setFilters, resetFilters };
}
