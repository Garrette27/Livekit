import { useState, useCallback } from 'react';
import { AppError } from '@/lib/error-handler';

interface ErrorHandlerState {
  error: string | null;
  isLoading: boolean;
}

export function useErrorHandler() {
  const [state, setState] = useState<ErrorHandlerState>({
    error: null,
    isLoading: false
  });

  const handleError = useCallback((error: unknown) => {
    let errorMessage = 'An unexpected error occurred';

    if (error instanceof AppError) {
      errorMessage = error.message;
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }

    setState(prev => ({ ...prev, error: errorMessage, isLoading: false }));
  }, []);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  const setLoading = useCallback((loading: boolean) => {
    setState(prev => ({ ...prev, isLoading: loading }));
  }, []);

  const withErrorHandling = useCallback(async <T>(
    asyncFn: () => Promise<T>
  ): Promise<T | null> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const result = await asyncFn();
      setState(prev => ({ ...prev, isLoading: false }));
      return result;
    } catch (error) {
      handleError(error);
      return null;
    }
  }, [handleError]);

  return {
    error: state.error,
    isLoading: state.isLoading,
    handleError,
    clearError,
    setLoading,
    withErrorHandling
  };
}