import { Container, Paper, Title, Text, Button, Box, Group } from '@mantine/core';
import { IconLock, IconArrowLeft } from '@tabler/icons-react';
import { useNavigate, useParams } from 'react-router-dom';

/**
 * AccessDenied page displays when a user attempts to access a cluster
 * they don't have permission to view.
 *
 * Features:
 * - Clear message explaining the access denial
 * - Optional cluster name display if available in route params
 * - Link back to cluster list (Dashboard)
 * - User-friendly design with appropriate iconography
 */
export function AccessDenied() {
  const navigate = useNavigate();
  const { clusterName } = useParams<{ clusterName?: string }>();

  const handleReturnToClusters = () => {
    navigate('/');
  };

  return (
    <Container size="sm" py="xl">
      <Box style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Paper shadow="md" p="xl" radius="md" withBorder w="100%" ta="center">
          <IconLock size={64} stroke={1.5} style={{ marginBottom: '1.5rem' }} />
          
          <Title order={2} mb="md">
            Access Denied
          </Title>
          
          <Text size="lg" c="dimmed" mb="md">
            {clusterName
              ? `You don't have permission to access the cluster "${clusterName}".`
              : "You don't have permission to access this resource."}
          </Text>
          
          <Text size="sm" c="dimmed" mb="xl">
            Your account doesn't have the necessary permissions to view or interact with this cluster.
            Please contact your administrator if you believe you should have access.
          </Text>

          <Group justify="center">
            <Button
              leftSection={<IconArrowLeft size={18} />}
              onClick={handleReturnToClusters}
              variant="outline"
            >
              Return to Cluster List
            </Button>
          </Group>
        </Paper>
      </Box>
    </Container>
  );
}
