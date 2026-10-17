import { useEffect, useState } from 'react';

/** Create object URLs for a list of Blobs and revoke them when the list changes. */
export function useObjectUrls(blobs: Blob[]): string[] {
  const [urls, setUrls] = useState<string[]>([]);
  useEffect(() => {
    // Created inside the effect to be safe with StrictMode double-invoke.
    const next = blobs.map((b) => URL.createObjectURL(b));
    setUrls(next);
    return () => next.forEach((u) => URL.revokeObjectURL(u));
  }, [blobs]);
  return urls;
}
