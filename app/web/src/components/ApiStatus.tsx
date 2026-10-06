import { Badge, Tooltip } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { healthQuery } from '@/api/queries';
import { API_BASE_URL } from '@/api/client';

/** Live `GET /health` of the Dreamhouse API, through the generated client + TanStack Query. */
export function ApiStatus() {
  const { data, isPending, isError } = useQuery(healthQuery);

  const color = isPending ? 'gray' : isError ? 'red' : 'green';
  const label = isPending ? 'API …' : isError ? 'API down' : `API ${data.version}`;
  const tooltip = isError
    ? `No response from ${API_BASE_URL}/health`
    : data
      ? `${data.service} ${data.version}, up ${Math.round(data.uptimeSeconds)}s — ${API_BASE_URL}`
      : 'Checking API…';

  return (
    <Tooltip label={tooltip}>
      <Badge variant="dot" color={color} size="sm" data-testid="api-status">
        {label}
      </Badge>
    </Tooltip>
  );
}
