import React from 'react';
import { Alert, Button, Stack } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import { isRouteErrorResponse, useRouteError } from 'react-router-dom';

/**
 * Route-level error element for react-router.
 *
 * Rendered by the router when a route element throws during render
 * (e.g. third-party editor lifecycle errors). Replaces the default
 * react-router error page with the app's standard Alert fallback.
 */
export function RouteErrorBoundary(): React.ReactElement {
  const error = useRouteError();

  let message = 'An unexpected error occurred.';
  if (isRouteErrorResponse(error)) {
    message = `${error.status} ${error.statusText}`;
  } else if (error instanceof Error) {
    message = error.message;
  }

  console.error('[RouteErrorBoundary] Caught route error:', error);

  return (
    <Stack p="md">
      <Alert color="red" title="Something went wrong" icon={<IconAlertCircle />}>
        {message}
      </Alert>
      <Button color="red" variant="outline" onClick={() => window.location.reload()}>
        Reload page
      </Button>
    </Stack>
  );
}

export default RouteErrorBoundary;
