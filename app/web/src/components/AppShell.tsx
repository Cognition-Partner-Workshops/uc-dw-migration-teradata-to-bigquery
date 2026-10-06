import {
  ActionIcon,
  AppShell as MantineAppShell,
  Avatar,
  Badge,
  Burger,
  Group,
  Menu,
  NavLink,
  ScrollArea,
  Text,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconLogout } from '@tabler/icons-react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/use-auth';
import { appTabs, findActiveTab } from '@/app/tabs';
import { ApiStatus } from './ApiStatus';
import { DreamhouseLogo } from './DreamhouseLogo';

export function AppShell() {
  const [opened, { toggle, close }] = useDisclosure();
  const { user, mode, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const activeTab = findActiveTab(location.pathname);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  return (
    <MantineAppShell
      header={{ height: 56 }}
      navbar={{ width: 240, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding="md"
    >
      <MantineAppShell.Header>
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap">
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <UnstyledButton component={Link} to="/" aria-label="Dreamhouse home">
              <Group gap="xs" wrap="nowrap">
                <DreamhouseLogo size={32} />
                <Text fw={700} size="lg">
                  Dreamhouse
                </Text>
              </Group>
            </UnstyledButton>
            {activeTab && (
              <Text c="dimmed" size="sm" visibleFrom="sm" data-testid="active-tab">
                / {activeTab.label}
              </Text>
            )}
          </Group>
          <Group gap="sm" wrap="nowrap">
            <ApiStatus />
            {mode === 'stub' && (
              <Tooltip label="VITE_AUTH_MODE=stub — local sign-in, no Cognito calls">
                <Badge variant="light" color="yellow" size="sm">
                  stub auth
                </Badge>
              </Tooltip>
            )}
            <Menu shadow="md" width={220} position="bottom-end">
              <Menu.Target>
                <UnstyledButton aria-label="User menu">
                  <Group gap="xs" wrap="nowrap">
                    <Avatar color="dreamhouse" radius="xl" size="sm">
                      {user?.displayName.slice(0, 1).toUpperCase()}
                    </Avatar>
                    <Text size="sm" visibleFrom="sm">
                      {user?.displayName}
                    </Text>
                  </Group>
                </UnstyledButton>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>{user?.email ?? user?.username}</Menu.Label>
                <Menu.Item leftSection={<IconLogout size={16} />} onClick={handleSignOut}>
                  Sign out
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>
      </MantineAppShell.Header>

      <MantineAppShell.Navbar p="xs">
        <MantineAppShell.Section grow component={ScrollArea}>
          <nav aria-label="Dreamhouse tabs">
            {appTabs.map((tab) => (
              <NavLink
                key={tab.id}
                component={Link}
                to={tab.path}
                label={tab.label}
                leftSection={<tab.icon size={18} stroke={1.6} />}
                active={activeTab?.id === tab.id}
                onClick={close}
                data-testid={`tab-${tab.id}`}
                data-salesforce-tab={tab.salesforceTab}
              />
            ))}
          </nav>
        </MantineAppShell.Section>
        <MantineAppShell.Section>
          <Group justify="space-between" px="xs" pb="xs">
            <Text size="xs" c="dimmed">
              v{__APP_VERSION__}
            </Text>
            <Tooltip label="Sign out">
              <ActionIcon
                variant="subtle"
                color="gray"
                onClick={handleSignOut}
                aria-label="Sign out"
              >
                <IconLogout size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </MantineAppShell.Section>
      </MantineAppShell.Navbar>

      <MantineAppShell.Main>
        <Outlet />
      </MantineAppShell.Main>
    </MantineAppShell>
  );
}
