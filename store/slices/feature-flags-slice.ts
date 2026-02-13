import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface FeatureFlagsState {
  aiBillingEnforced: boolean;
  aiDefaultEnabled: boolean;
}

function parseBoolean(raw: string | undefined, fallback: boolean): boolean {
  if (!raw) {
    return fallback;
  }

  const normalized = raw.trim().toLowerCase();
  if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
    return true;
  }
  if (normalized === 'false' || normalized === '0' || normalized === 'no') {
    return false;
  }

  return fallback;
}

const initialState: FeatureFlagsState = {
  // Disabled by default for now: AI does not require payment unless explicitly enabled.
  aiBillingEnforced: parseBoolean(process.env.NEXT_PUBLIC_AI_BILLING_ENFORCED, false),
  aiDefaultEnabled: parseBoolean(process.env.NEXT_PUBLIC_AI_FEATURE_DEFAULT_ENABLED, true),
};

const featureFlagsSlice = createSlice({
  name: 'featureFlags',
  initialState,
  reducers: {
    setAiBillingEnforced(state, action: PayloadAction<boolean>) {
      state.aiBillingEnforced = action.payload;
    },
    setAiDefaultEnabled(state, action: PayloadAction<boolean>) {
      state.aiDefaultEnabled = action.payload;
    },
  },
});

export const { setAiBillingEnforced, setAiDefaultEnabled } = featureFlagsSlice.actions;
export default featureFlagsSlice.reducer;
