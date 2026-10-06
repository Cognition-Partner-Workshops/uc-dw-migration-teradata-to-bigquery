import { ActionIcon, Group, Text } from '@mantine/core';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';

/** SOQL OFFSET cannot exceed 2000; the port keeps the same ceiling. */
export const MAX_ITEM_OFFSET = 2000;

/** Port of `c/paginator`: `<count> items • page <n> of <total>` with Previous / Next. */
export function Paginator({
  pageNumber,
  pageSize,
  totalItemCount,
  onPrevious,
  onNext,
}: {
  pageNumber: number;
  pageSize: number;
  totalItemCount: number;
  onPrevious?: () => void;
  onNext?: () => void;
}) {
  const totalPages = pageSize > 0 ? Math.ceil(totalItemCount / pageSize) : 0;
  const currentPageNumber = totalItemCount === 0 ? 0 : pageNumber;
  const isNotFirstPage = pageNumber > 1;
  const isNotLastPage = pageNumber < totalPages && pageNumber * pageSize < MAX_ITEM_OFFSET;

  return (
    <Group justify="space-between" align="center" mt="xs" wrap="nowrap" data-testid="paginator">
      <div style={{ width: 34 }}>
        {isNotFirstPage && (
          <ActionIcon
            variant="default"
            aria-label="Previous"
            onClick={onPrevious}
            data-testid="paginator-previous"
          >
            <IconChevronLeft size={18} />
          </ActionIcon>
        )}
      </div>
      <Text size="sm" ta="center" data-testid="paginator-info">
        {totalItemCount} items • page {currentPageNumber} of {totalPages}
      </Text>
      <div style={{ width: 34, textAlign: 'right' }}>
        {isNotLastPage && (
          <ActionIcon
            variant="default"
            aria-label="Next"
            onClick={onNext}
            data-testid="paginator-next"
          >
            <IconChevronRight size={18} />
          </ActionIcon>
        )}
      </div>
    </Group>
  );
}
