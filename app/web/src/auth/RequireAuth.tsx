import { Center, Loader } from '@mantine/core';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { AccessDeniedPage } from '@/pages/AccessDeniedPage';
import { DREAMHOUSE_GROUP, hasGroup } from './groups';
import { useAuth } from './use-auth';

/** Signed-in users only; and, like the Dreamhouse app's visibility, only those in the `dreamhouse` group. */
export function RequireAuth() {
  const { status, user } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return (
      <Center h="100vh">
        <Loader aria-label="Checking session" />
      </Center>
    );
  }
  if (status === 'signedOut') {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  if (!hasGroup(user?.groups, DREAMHOUSE_GROUP)) {
    return <AccessDeniedPage scope="app" />;
  }
  return <Outlet />;
}
