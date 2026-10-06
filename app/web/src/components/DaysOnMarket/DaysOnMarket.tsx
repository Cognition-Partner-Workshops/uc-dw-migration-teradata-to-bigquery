import { Box, Group, Paper, Text } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { propertyQuery } from '@/api/queries';
import { ErrorPanel } from '@/components/ErrorPanel/ErrorPanel';
import { formatDate } from '@/lib/format';
import { daysOnMarket } from '@/pages/properties/propertyLayout';
import { useSelectedProperty } from '@/state/selectedProperty';
import { daysOnMarketStatus, MAX_DAYS_CHART } from './daysOnMarketStatus';
import classes from './DaysOnMarket.module.css';

/**
 * Port of `c/daysOnMarket`: badge + bar chart of `Days_On_Market__c` (0-90 days scale with the
 * Date Listed / 30 days / 60 days legend). On a record page `recordId` is the property; on an app
 * page it subscribes `PropertySelected` (the `selected` URL param).
 */
export function DaysOnMarket({ recordId }: { recordId?: string }) {
  const selected = useSelectedProperty();
  const propertyId = recordId ?? selected.propertyId ?? '';
  const property = useQuery(propertyQuery(propertyId));

  const days = property.data ? daysOnMarket(property.data.dateListed) : 0;
  const status = daysOnMarketStatus(days);
  const width = `${Math.min(100, (days / MAX_DAYS_CHART) * 100)}%`;

  return (
    <Paper withBorder p="xs" data-testid="days-on-market" data-property-id={propertyId}>
      {property.data && days > 0 && (
        <Group wrap="nowrap" align="stretch" gap={0} data-testid="days-on-market-chart">
          <div
            className={`${classes.badge} ${classes[status]}`}
            data-testid="days-on-market-badge"
            data-status={status}
          >
            <Text size="xl" fw={700} className="days" data-testid="days-on-market-days">
              {days}
            </Text>
            <Text size="xs">
              days on
              <br />
              the market
            </Text>
          </div>
          <Box pos="relative" style={{ flex: 1 }}>
            <div
              className={`${classes.bar} ${classes[status]}`}
              style={{ width }}
              data-testid="days-on-market-bar"
              data-status={status}
            />
            <div className={classes.axis}>
              <div>
                <Text size="xs" className={classes.legend} data-testid="days-on-market-date-listed">
                  {formatDate(property.data.dateListed)}
                </Text>
              </div>
              <div>
                <Text size="xs" className={classes.legend}>
                  30 days
                </Text>
              </div>
              <div>
                <Text size="xs" className={classes.legend}>
                  60 days
                </Text>
              </div>
            </div>
          </Box>
        </Group>
      )}
      {property.data && days === 0 && (
        <Text size="sm" c="dimmed" ta="center" py="sm" data-testid="days-on-market-not-listed">
          Not on the market yet (no Date Listed).
        </Text>
      )}
      {!propertyId && <ErrorPanel friendlyMessage="Select a property to see days on the market" />}
      {property.isError && (
        <ErrorPanel friendlyMessage="Error retrieving data" errors={property.error} />
      )}
    </Paper>
  );
}
