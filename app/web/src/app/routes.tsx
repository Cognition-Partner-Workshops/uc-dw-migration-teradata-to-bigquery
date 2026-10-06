import { createBrowserRouter, createMemoryRouter, type RouteObject } from 'react-router-dom';
import { RequireAuth } from '@/auth/RequireAuth';
import { RequireGroup } from '@/auth/RequireGroup';
import { AppShell } from '@/app/AppShell';
import { BrokerRecordPage } from '@/pages/BrokerRecordPage';
import { BrokersPage } from '@/pages/BrokersPage';
import { ContactsPage } from '@/pages/ContactsPage';
import { FilesPage } from '@/pages/FilesPage';
import { HomePage } from '@/pages/HomePage';
import { LoginPage } from '@/pages/LoginPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { PropertiesPage } from '@/pages/PropertiesPage';
import { PropertyExplorerPage } from '@/pages/PropertyExplorerPage';
import { PropertyFinderPage } from '@/pages/PropertyFinderPage';
import { PropertyRecordPage } from '@/pages/PropertyRecordPage';
import { SettingsPage } from '@/pages/SettingsPage';

/** One route per tab in `appTabs` (plus record pages and login). */
export const routes: RouteObject[] = [
  { path: '/login', element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: '/', element: <HomePage /> },
          { path: '/property-explorer', element: <PropertyExplorerPage /> },
          { path: '/property-finder', element: <PropertyFinderPage /> },
          { path: '/contacts', element: <ContactsPage /> },
          { path: '/properties', element: <PropertiesPage /> },
          { path: '/properties/:id', element: <PropertyRecordPage /> },
          { path: '/brokers', element: <BrokersPage /> },
          { path: '/brokers/:id', element: <BrokerRecordPage /> },
          { path: '/files', element: <FilesPage /> },
          {
            path: '/settings',
            element: (
              <RequireGroup group="dreamhouse-admin">
                <SettingsPage />
              </RequireGroup>
            ),
          },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
];

export const createAppRouter = () => createBrowserRouter(routes);
export const createTestRouter = (initialEntries: string[] = ['/']) =>
  createMemoryRouter(routes, { initialEntries });
