import { Card, SimpleGrid, Text, ThemeIcon, Title, UnstyledButton } from '@mantine/core';
import { Link } from 'react-router-dom';
import { appTabs } from '@/app/navigation';
import { PageHeader } from '@/components/PageHeader/PageHeader';

export function HomePage() {
  const tiles = appTabs.filter((tab) => tab.id !== 'home');
  return (
    <>
      <PageHeader
        title="Welcome to Dreamhouse"
        subtitle="Real-estate listings — the Salesforce Dreamhouse app re-implemented on React, NestJS and PostgreSQL."
      />
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
        {tiles.map((tab) => (
          <UnstyledButton key={tab.id} component={Link} to={tab.path}>
            <Card withBorder shadow="xs" h="100%">
              <ThemeIcon variant="light" size="lg" mb="sm">
                <tab.icon size={20} />
              </ThemeIcon>
              <Title order={4}>{tab.label}</Title>
              <Text size="xs" c="dimmed" mt={4}>
                Replaces {tab.salesforcePage}
              </Text>
            </Card>
          </UnstyledButton>
        ))}
      </SimpleGrid>
    </>
  );
}
