import { Firestore } from 'firebase-admin/firestore';

export type AiFeatureKey = 'consultation_summary' | 'chat_file_extraction' | 'chat_history_ai';

export interface AiEntitlementDecision {
  enabled: boolean;
  feature: AiFeatureKey;
  source: 'billing-entitlement' | 'environment-default' | 'environment-override';
  reason: string;
  planId?: string | null;
}

interface BillingEntitlementRecord {
  status?: 'active' | 'trialing' | 'past_due' | 'canceled' | 'inactive';
  planId?: string;
  aiEnabled?: boolean;
  aiFeatures?: Partial<Record<AiFeatureKey, boolean>>;
}

function readEnvBoolean(name: string): boolean | null {
  const raw = process.env[name];
  if (!raw) {
    return null;
  }

  const normalized = raw.trim().toLowerCase();
  if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
    return true;
  }
  if (normalized === 'false' || normalized === '0' || normalized === 'no') {
    return false;
  }

  return null;
}

function defaultEnabledDecision(feature: AiFeatureKey): AiEntitlementDecision {
  const envDefault = readEnvBoolean('AI_FEATURE_DEFAULT_ENABLED');
  const enabled = envDefault !== null ? envDefault : true;

  return {
    enabled,
    feature,
    source: 'environment-default',
    reason: enabled
      ? 'AI enabled by default configuration'
      : 'AI disabled by default configuration',
    planId: null,
  };
}

function isBillingEnforced(): boolean {
  const envValue = readEnvBoolean('AI_BILLING_ENFORCED');
  // Payment enforcement is off by default for now.
  return envValue === true;
}

/**
 * Centralize AI feature entitlement checks so payment logic remains hidden behind one module.
 */
export async function resolveAiEntitlement(
  db: Firestore | undefined,
  userId: string,
  feature: AiFeatureKey
): Promise<AiEntitlementDecision> {
  const forceDisable = readEnvBoolean('AI_FEATURE_FORCE_DISABLED');
  if (forceDisable === true) {
    return {
      enabled: false,
      feature,
      source: 'environment-override',
      reason: 'AI force-disabled by environment override',
      planId: null,
    };
  }

  if (!db || !userId) {
    return defaultEnabledDecision(feature);
  }

  if (!isBillingEnforced()) {
    return {
      ...defaultEnabledDecision(feature),
      reason: 'Billing enforcement disabled; AI feature follows default configuration',
    };
  }

  try {
    const entitlementRef = db.collection('billingEntitlements').doc(userId);
    const entitlementDoc = await entitlementRef.get();
    if (!entitlementDoc.exists) {
      return defaultEnabledDecision(feature);
    }

    const record = entitlementDoc.data() as BillingEntitlementRecord;
    const billingActive = record.status === 'active' || record.status === 'trialing';
    const featureEnabled = Boolean(record.aiFeatures?.[feature] ?? record.aiEnabled);
    const enabled = billingActive && featureEnabled;

    return {
      enabled,
      feature,
      source: 'billing-entitlement',
      reason: enabled
        ? `AI feature '${feature}' is enabled for current plan`
        : `AI feature '${feature}' is disabled or billing is not active`,
      planId: record.planId || null,
    };
  } catch (error) {
    console.error('Error resolving AI entitlement:', error);
    return defaultEnabledDecision(feature);
  }
}
