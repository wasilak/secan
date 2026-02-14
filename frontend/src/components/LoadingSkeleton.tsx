import { Container, Stack, Card, Skeleton, Group } from '@mantine/core';

/**
 * Loading skeleton for editor pages (IndexSettings, IndexMappings, etc.)
 */
export function EditorPageSkeleton() {
  return (
    <Container size="xl" py="md">
      <Group justify="space-between" mb="md">
        <div>
          <Skeleton height={32} width={200} mb="xs" />
          <Skeleton height={20} width={150} />
        </div>
        <Skeleton height={36} width={120} />
      </Group>

      <Stack gap="md">
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Skeleton height={24} width={150} mb="md" />
          <Skeleton height={400} />
        </Card>

        <Card shadow="sm" padding="md" radius="md" withBorder>
          <Skeleton height={20} width="100%" mb="xs" />
          <Skeleton height={20} width="90%" />
        </Card>
      </Stack>
    </Container>
  );
}

/**
 * Loading skeleton for table pages (Dashboard, Indices, etc.)
 */
export function TablePageSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <Container size="xl" py="md">
      <Group justify="space-between" mb="md">
        <Skeleton height={32} width={200} />
        <Group>
          <Skeleton height={36} width={100} />
          <Skeleton height={36} width={100} />
        </Group>
      </Group>

      <Card shadow="sm" padding="lg" radius="md" withBorder>
        {/* Table header */}
        <Group mb="md" gap="md">
          <Skeleton height={20} width="20%" />
          <Skeleton height={20} width="15%" />
          <Skeleton height={20} width="15%" />
          <Skeleton height={20} width="20%" />
          <Skeleton height={20} width="15%" />
        </Group>

        {/* Table rows */}
        <Stack gap="sm">
          {Array.from({ length: rows }).map((_, index) => (
            <Group key={index} gap="md">
              <Skeleton height={40} width="20%" />
              <Skeleton height={40} width="15%" />
              <Skeleton height={40} width="15%" />
              <Skeleton height={40} width="20%" />
              <Skeleton height={40} width="15%" />
            </Group>
          ))}
        </Stack>
      </Card>
    </Container>
  );
}

/**
 * Loading skeleton for dashboard cards
 */
export function DashboardSkeleton() {
  return (
    <Container size="xl" py="md">
      <Skeleton height={32} width={200} mb="xl" />

      <Stack gap="lg">
        {/* Cluster cards */}
        {Array.from({ length: 3 }).map((_, index) => (
          <Card key={index} shadow="sm" padding="lg" radius="md" withBorder>
            <Group justify="space-between" mb="md">
              <div>
                <Skeleton height={24} width={150} mb="xs" />
                <Skeleton height={16} width={200} />
              </div>
              <Skeleton height={32} width={80} />
            </Group>

            <Group gap="xl">
              <div>
                <Skeleton height={16} width={60} mb="xs" />
                <Skeleton height={24} width={40} />
              </div>
              <div>
                <Skeleton height={16} width={60} mb="xs" />
                <Skeleton height={24} width={40} />
              </div>
              <div>
                <Skeleton height={16} width={60} mb="xs" />
                <Skeleton height={24} width={40} />
              </div>
            </Group>
          </Card>
        ))}
      </Stack>
    </Container>
  );
}

/**
 * Loading skeleton for detail pages (NodeDetail, IndexStatistics, etc.)
 */
export function DetailPageSkeleton() {
  return (
    <Container size="xl" py="md">
      <Group justify="space-between" mb="md">
        <div>
          <Skeleton height={32} width={200} mb="xs" />
          <Skeleton height={20} width={150} />
        </div>
        <Skeleton height={36} width={120} />
      </Group>

      <Stack gap="md">
        {/* Stats cards */}
        <Group grow>
          {Array.from({ length: 4}).map((_, index) => (
            <Card key={index} shadow="sm" padding="md" radius="md" withBorder>
              <Skeleton height={16} width="60%" mb="xs" />
              <Skeleton height={24} width="40%" />
            </Card>
          ))}
        </Group>

        {/* Main content */}
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Skeleton height={24} width={150} mb="md" />
          <Stack gap="sm">
            {Array.from({ length: 8 }).map((_, index) => (
              <Group key={index} justify="space-between">
                <Skeleton height={20} width="30%" />
                <Skeleton height={20} width="50%" />
              </Group>
            ))}
          </Stack>
        </Card>
      </Stack>
    </Container>
  );
}
