import { Button, Card, Group, Input, Slider, Stack, TextInput, Title } from '@mantine/core';
import { useEffect, useRef, useState } from 'react';
import { FILTER_DEFAULTS, usePropertyFilters, type PropertyFilters } from '@/state/propertyFilters';
import { formatCurrency } from '@/lib/format';

/** `propertyFilter` debounces every change by 350ms before publishing `FiltersChange`. */
export const FILTER_CHANGE_DELAY = 350;
export const MAX_PRICE = FILTER_DEFAULTS.maxPrice;

/**
 * Port of `c/propertyFilter`: Search Key, Max Price, Bedrooms, Bathrooms (same labels, order,
 * ranges and steps) with a Reset action; publishes the criteria to the URL via
 * `usePropertyFilters` after the same 350ms delay.
 */
export function PropertyFilter() {
  const { filters, setFilters } = usePropertyFilters();
  const [draft, setDraft] = useState<PropertyFilters>(filters);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  // Another publisher (Reset, back/forward navigation, a shared link) changed the URL.
  useEffect(() => {
    setDraft(filters);
  }, [filters]);

  useEffect(() => () => clearTimeout(timer.current), []);

  const delayedFireFilterChangeEvent = (next: PropertyFilters) => {
    setDraft(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setFilters(next), FILTER_CHANGE_DELAY);
  };

  const handleReset = () => {
    clearTimeout(timer.current);
    setDraft(FILTER_DEFAULTS);
    setFilters(FILTER_DEFAULTS);
  };

  return (
    <Card withBorder padding="md" data-testid="property-filter">
      <Card.Section withBorder inheritPadding py="xs">
        <Group justify="space-between" wrap="nowrap">
          <Title order={3} size="h5">
            Filters
          </Title>
          <Button
            variant="default"
            size="xs"
            onClick={handleReset}
            data-testid="property-filter-reset"
          >
            Reset
          </Button>
        </Group>
      </Card.Section>
      <Stack gap="md" mt="md">
        <TextInput
          label="Search Key"
          type="text"
          value={draft.searchKey}
          onChange={(event) =>
            delayedFireFilterChangeEvent({ ...draft, searchKey: event.currentTarget.value })
          }
          data-testid="property-filter-search-key"
        />
        <Input.Wrapper label="Max Price" description={formatCurrency(draft.maxPrice)}>
          <Slider
            mt="xs"
            step={50_000}
            min={0}
            max={MAX_PRICE}
            value={draft.maxPrice}
            label={formatCurrency}
            thumbLabel="Max Price"
            onChange={(maxPrice) => delayedFireFilterChangeEvent({ ...draft, maxPrice })}
            data-testid="property-filter-max-price"
          />
        </Input.Wrapper>
        <Input.Wrapper label="Bedrooms" description={String(draft.minBedrooms)}>
          <Slider
            mt="xs"
            step={1}
            min={0}
            max={6}
            value={draft.minBedrooms}
            thumbLabel="Bedrooms"
            onChange={(minBedrooms) => delayedFireFilterChangeEvent({ ...draft, minBedrooms })}
            data-testid="property-filter-min-bedrooms"
          />
        </Input.Wrapper>
        <Input.Wrapper label="Bathrooms" description={String(draft.minBathrooms)}>
          <Slider
            mt="xs"
            step={1}
            min={0}
            max={6}
            value={draft.minBathrooms}
            thumbLabel="Bathrooms"
            onChange={(minBathrooms) => delayedFireFilterChangeEvent({ ...draft, minBathrooms })}
            data-testid="property-filter-min-bathrooms"
          />
        </Input.Wrapper>
      </Stack>
    </Card>
  );
}
