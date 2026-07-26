import { useEffect, useState } from 'react';

export function useErrorHandler(...errors: (string | null | undefined)[]) {
  const [pageError, setPageError] = useState<string | null>(null);
  const activeError = errors.find((error) => error) || null;

  useEffect(() => {
    setPageError(activeError);
  }, [activeError]);

  return { pageError, setPageError };
}

