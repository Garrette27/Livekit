import { useEffect, useState } from 'react';

export function useErrorHandler(...errors: (string | null | undefined)[]) {
  const [pageError, setPageError] = useState<string | null>(null);

  useEffect(() => {
    const error = errors.find((err) => err);
    setPageError(error || null);
  }, [...errors]);

  return { pageError, setPageError };
}

