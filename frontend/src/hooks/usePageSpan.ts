/**
 * React hook for creating page-level OpenTelemetry spans
 * 
 * This hook creates a parent span that encompasses all operations
 * on a page, ensuring all child API calls are nested properly.
 * 
 * IMPORTANT: This uses context.with() to make the span active,
 * which allows FetchInstrumentation to automatically parent spans.
 */

import { useEffect } from 'react';
import { trace, context } from '@opentelemetry/api';

interface UsePageSpanOptions {
  pageName: string;
  attributes?: Record<string, string | number | boolean>;
}

/**
 * Create a parent span for the current page/component.
 * This span will be the parent for all child API calls.
 */
export function usePageSpan({ pageName, attributes = {} }: UsePageSpanOptions): void {
  useEffect(() => {
    const tracer = trace.getTracer('secan-frontend', '1.2.28');
    
    // Create parent span for this page view
    const span = tracer.startSpan(`page.${pageName}`, {
      attributes: {
        'page.name': pageName,
        'page.route': window.location.pathname,
        ...attributes,
      },
    });

    // Make this span the current context - THIS IS THE KEY!
    // All child spans (from FetchInstrumentation) will automatically
    // be parented to this span
    trace.setSpan(context.active(), span);
    
    // Store cleanup function
    const cleanup = () => {
      span.end();
      console.log(`[OTel] Ended page span: page.${pageName}`);
    };

    console.log(`[OTel] Started page span: page.${pageName}`);
    console.log(`[OTel] Trace ID: ${span.spanContext().traceId}`);
    
    return cleanup;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageName]); // Only re-create if pageName changes
}

/**
 * Wrap an async operation with a child span
 * Uses startActiveSpan to properly set context for nested operations
 */
export async function withSpan<T>(
  name: string,
  operation: () => Promise<T>,
  attributes?: Record<string, string | number | boolean>
): Promise<T> {
  const tracer = trace.getTracer('secan-frontend', '1.2.28');
  
  return tracer.startActiveSpan(name, async (span) => {
    try {
      if (attributes) {
        Object.entries(attributes).forEach(([key, value]) => {
          span.setAttribute(key, value);
        });
      }
      
      const result = await operation();
      span.setStatus({ code: 1 }); // OK
      return result;
    } catch (error) {
      span.setStatus({ 
        code: 2, // ERROR
        message: error instanceof Error ? error.message : String(error)
      });
      throw error;
    } finally {
      span.end();
    }
  });
}
