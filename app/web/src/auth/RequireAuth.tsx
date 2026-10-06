import { Center, Loader } from '@mantine/core';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './use-auth';

export function RequireAuth() {
  const { status } = useAuth();
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
  return <Outlet />;
}
