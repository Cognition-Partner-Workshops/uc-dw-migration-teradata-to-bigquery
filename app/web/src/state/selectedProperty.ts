import { useCallback, useSyncExternalStore } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { PropertySummaryDto } from '@/api/types';

/**
 * Port of the `PropertySelected__c` Lightning message channel. The selected property id lives in
 * the `selected` URL search param (publish = `selectProperty`, subscribe = `useSelectedProperty`)
 * so a selection is linkable, and a small shared store keeps the `PropertySummaryDto` records the
 * list / map components loaded from GET /properties so the subscribers (PropertySummary,
 * PropertyMap) can render the selected record without a second round trip.
 */
export const SELECTED_PARAM = 'selected';

const records = new Map<string, PropertySummaryDto>();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Called by every GET /properties consumer with the records it received. */
export function rememberProperties(list: readonly PropertySummaryDto[]) {
  let changed = false;
  for (const property of list) {
    if (records.get(property.id) !== property) {
      records.set(property.id, property);
      changed = true;
    }
  }
  if (changed) {
    emit();
  }
}

export function getRememberedProperty(id: string): PropertySummaryDto | undefined {
  return records.get(id);
}

/** Test helper. */
export function clearRememberedProperties() {
  records.clear();
  emit();
}

export function useRememberedProperty(id: string | null): PropertySummaryDto | null {
  return useSyncExternalStore(subscribe, () => (id ? (records.get(id) ?? null) : null));
}

export function useSelectedProperty() {
  const [searchParams, setSearchParams] = useSearchParams();
  const propertyId = searchParams.get(SELECTED_PARAM);
  const property = useRememberedProperty(propertyId);

  /** `publish(messageContext, PROPERTYSELECTEDMC, { propertyId })`. */
  const selectProperty = useCallback(
    (id: string | null) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          if (id) {
            next.set(SELECTED_PARAM, id);
          } else {
            next.delete(SELECTED_PARAM);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  return { propertyId, property, selectProperty };
}
