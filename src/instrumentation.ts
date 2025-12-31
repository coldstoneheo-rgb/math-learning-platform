/**
 * Next.js Instrumentation Hook
 *
 * 서버 시작 시 Sentry 초기화
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config');
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config');
  }
}

export const onRequestError = (
  err: Error,
  request: {
    path: string;
    method: string;
    headers: Record<string, string>;
  },
  context: {
    routerKind: 'Pages Router' | 'App Router';
    routePath: string;
    routeType: 'render' | 'route' | 'action' | 'middleware';
    renderSource?: 'react-server-components' | 'react-server-components-payload' | 'server-rendering';
    revalidateReason?: 'on-demand' | 'stale' | undefined;
    renderType?: 'dynamic' | 'dynamic-resume';
  }
) => {
  // Sentry에 에러 보고
  import('@sentry/nextjs').then(({ captureException, setContext }) => {
    setContext('request', {
      path: request.path,
      method: request.method,
    });
    setContext('routing', {
      routerKind: context.routerKind,
      routePath: context.routePath,
      routeType: context.routeType,
    });
    captureException(err);
  });
};
