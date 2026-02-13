'use client';

import { Provider } from 'react-redux';
import { store } from '@/store';
import { ReactNode } from 'react';

interface AppProvidersProps {
  children: ReactNode;
}

export default function AppProviders({ children }: AppProvidersProps) {
  return <Provider store={store}>{children}</Provider>;
}
