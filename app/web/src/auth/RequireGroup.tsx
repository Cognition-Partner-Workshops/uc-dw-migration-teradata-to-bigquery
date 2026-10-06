import type { ReactNode } from 'react';
import { AccessDeniedPage } from '@/pages/AccessDeniedPage';
import { hasGroup, type DreamhouseGroup } from './groups';
import { useAuth } from './use-auth';

/** Renders `children` only for users in `group`; otherwise the tab-level access-denied page. */
export function RequireGroup({ group, children }: { group: DreamhouseGroup; children: ReactNode }) {
  const { user } = useAuth();
  if (!hasGroup(user?.groups, group)) return <AccessDeniedPage scope="tab" />;
  return <>{children}</>;
}
