import { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';

/**
 * Configure Monaco Editor to use bundled files instead of CDN
 *
 * This prevents CSP violations and ensures the editor works offline.
 * Must be called before any Monaco Editor component is rendered.
 */
export function configureMonaco() {
  // Use the bundled monaco-editor package
  loader.config({ monaco });
}
