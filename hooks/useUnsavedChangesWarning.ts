'use client';

import { useEffect } from 'react';

/**
 * Native "leave site?" prompt while attendance is marked but unsaved.
 *
 * Safari only shows this for real navigations away from the page; in-app
 * navigation is guarded separately by the leave-confirmation dialog, and the
 * localStorage draft is the real safety net.
 */
export function useUnsavedChangesWarning(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;

    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Legacy requirement for some browsers to show the dialog.
      event.returnValue = '';
      return '';
    };

    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [enabled]);
}
