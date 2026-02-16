import { Container, Stack, Card, Skeleton, Group, Grid } from '@mantine/core';
import { FullWidthContainer } from './FullWidthContainer';

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

/**
 * Loading skeleton for node detail page with full-width layout
 */
export function NodeDetailSkeleton() {
  return (
    <FullWidthContainer>
      {/* Node Header Skeleton */}
      <Card shadow="sm" padding="lg" mb="md">
        <Group justify="space-between">
          <div style={{ flex: 1 }}>
            <Skeleton height={40} width={120} mb="xs" />
            <Skeleton height={32} width={250} mb="xs" />
            <Skeleton height={20} width={200} mb={4} />
            <Skeleton height={20} width={150} />
          </div>
          <div>
            <Skeleton height={20} width={60} mb="xs" />
            <Group gap="md">
              <Skeleton height={24} width={80} />
              <Skeleton height={24} width={80} />
            </Group>
          </div>
        </Group>
      </Card>

      {/* Info Cards Skeleton */}
      <Grid mb="md">
        {[1, 2, 3, 4, 5].map((i) => (
          <Grid.Col key={i} span={{ base: 12, sm: 6, md: 2.4 }}>
            <Card shadow="sm" padding="lg" h="100%">
              <Skeleton height={20} width={100} mb="xs" />
              <Skeleton height={28} width={80} />
            </Card>
          </Grid.Col>
        ))}
      </Grid>

      {/* Memory and Disk Skeleton */}
      <Grid mb="md">
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Card shadow="sm" padding="lg">
            <Skeleton height={20} width={150} mb="xs" />
            <Skeleton height={8} mb="xs" />
            <Skeleton height={16} width={200} />
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Card shadow="sm" padding="lg">
            <Skeleton height={20} width={150} mb="xs" />
            <Skeleton height={8} mb="xs" />
            <Skeleton height={16} width={200} />
          </Card>
        </Grid.Col>
      </Grid>

      {/* Performance Charts Skeleton */}
      <Card shadow="sm" padding="lg" mb="md">
        <Skeleton height={24} width={200} mb="md" />
        <Grid>
          {[1, 2, 3, 4].map((i) => (
            <Grid.Col key={i} span={{ base: 12, sm: 6 }}>
              <Skeleton height={200} />
            </Grid.Col>
          ))}
        </Grid>
      </Card>

      {/* Thread Pool Skeleton */}
      <Card shadow="sm" padding="lg">
        <Skeleton height={24} width={250} mb="md" />
        <Skeleton height={16} width="100%" mb="md" />
        <Stack gap="xs">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} height={40} />
          ))}
        </Stack>
      </Card>
    </FullWidthContainer>
  );
}

/**
 * Loading skeleton for list pages (Repositories, Aliases, Templates, Snapshots) with full-width layout
 */
export function ListPageSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <FullWidthContainer>
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
          <Skeleton height={20} width="25%" />
          <Skeleton height={20} width="20%" />
          <Skeleton height={20} width="20%" />
          <Skeleton height={20} width="20%" />
          <Skeleton height={20} width="15%" />
        </Group>

        {/* Table rows */}
        <Stack gap="sm">
          {Array.from({ length: rows }).map((_, index) => (
            <Group key={index} gap="md">
              <Skeleton height={40} width="25%" />
              <Skeleton height={40} width="20%" />
              <Skeleton height={40} width="20%" />
              <Skeleton height={40} width="20%" />
              <Skeleton height={40} width="15%" />
            </Group>
          ))}
        </Stack>
      </Card>
    </FullWidthContainer>
  );
}

/**
 * Loading skeleton for settings/editor pages with full-width layout
 */
export function SettingsPageSkeleton() {
  return (
    <FullWidthContainer>
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
    </FullWidthContainer>
  );
}

/**
 * Loading skeleton for shard management grid with full-width layout
 */
export function ShardGridSkeleton() {
  return (
    <FullWidthContainer>
      <Group justify="space-between" mb="md">
        <Skeleton height={32} width={200} />
        <Group>
          <Skeleton height={36} width={120} />
          <Skeleton height={36} width={100} />
        </Group>
      </Group>

      <Card shadow="sm" padding="lg" mb="md">
        <Skeleton height={20} width="100%" mb="md" />
        <Grid>
          {/* Simulate grid headers */}
          <Grid.Col span={2}>
            <Skeleton height={40} />
          </Grid.Col>
          {[1, 2, 3, 4, 5].map((i) => (
            <Grid.Col key={i} span={2}>
              <Skeleton height={40} />
            </Grid.Col>
          ))}
        </Grid>
      </Card>

      {/* Simulate shard rows */}
      <Stack gap="xs">
        {[1, 2, 3, 4, 5].map((i) => (
          <Card key={i} shadow="sm" padding="md">
            <Grid>
              <Grid.Col span={2}>
                <Skeleton height={60} />
              </Grid.Col>
              {[1, 2, 3, 4, 5].map((j) => (
                <Grid.Col key={j} span={2}>
                  <Group gap="xs">
                    <Skeleton height={30} width={30} />
                    <Skeleton height={30} width={30} />
                  </Group>
                </Grid.Col>
              ))}
            </Grid>
          </Card>
        ))}
      </Stack>
    </FullWidthContainer>
  );
}
