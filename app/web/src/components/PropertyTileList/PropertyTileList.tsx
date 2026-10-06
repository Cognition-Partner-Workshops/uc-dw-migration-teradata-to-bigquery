import { Center, Loader, Paper, SimpleGrid } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { propertiesQuery } from '@/api/queries';
import { ErrorPanel } from '@/components/ErrorPanel/ErrorPanel';
import { Paginator } from '@/components/Paginator/Paginator';
import { PropertyTile } from '@/components/PropertyTile/PropertyTile';
import { usePropertyFilters } from '@/state/propertyFilters';
import { rememberProperties, useSelectedProperty } from '@/state/selectedProperty';

export const PAGE_SIZE = 9;

/**
 * Port of `c/propertyTileList`: GET /properties for the current filters (subscribes
 * `FiltersChange` through the URL) paged by `Paginator`; selecting a tile publishes
 * `PropertySelected` (the `selected` URL param).
 */
export function PropertyTileList() {
  const { filters } = usePropertyFilters();
  const { selectProperty } = useSelectedProperty();

  // Like the LWC, a FiltersChange resets to page 1; keying the page on the filters does that
  // without an effect.
  const filtersKey = JSON.stringify(filters);
  const [pageState, setPageState] = useState({ key: filtersKey, pageNumber: 1 });
  const pageNumber = pageState.key === filtersKey ? pageState.pageNumber : 1;
  const setPageNumber = (next: number) => setPageState({ key: filtersKey, pageNumber: next });

  const { data, error, isPending } = useQuery(
    propertiesQuery({ ...filters, pageSize: PAGE_SIZE, pageNumber }),
  );

  useEffect(() => {
    if (data) {
      rememberProperties(data.records);
    }
  }, [data]);

  return (
    <Paper withBorder p="sm" data-testid="property-tile-list">
      {data && (
        <>
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="xs" data-testid="property-tiles">
            {data.records.map((property) => (
              <PropertyTile key={property.id} property={property} onSelected={selectProperty} />
            ))}
          </SimpleGrid>
          <Paginator
            pageNumber={pageNumber}
            pageSize={PAGE_SIZE}
            totalItemCount={data.totalItemCount}
            onPrevious={() => setPageNumber(pageNumber - 1)}
            onNext={() => setPageNumber(pageNumber + 1)}
          />
        </>
      )}
      {error && <ErrorPanel friendlyMessage="Error retrieving data" errors={error} />}
      {isPending && !error && (
        <Center py="xl" data-testid="property-tile-list-loading">
          <Loader size="sm" />
        </Center>
      )}
    </Paper>
  );
}
