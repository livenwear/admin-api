export const APP_FEATURES_SETTINGS_KEY = 'app.features';

export type AppFeaturesSettings = {
  /** When false, OTP is still issued & stored but Kavenegar is not called. */
  smsSendingEnabled: boolean;
};

export const DEFAULT_APP_FEATURES: AppFeaturesSettings = {
  smsSendingEnabled: true,
};

export function normalizeAppFeatures(raw: unknown): AppFeaturesSettings {
  const base = structuredClone(DEFAULT_APP_FEATURES);
  if (!raw || typeof raw !== 'object') return base;
  const input = raw as Partial<AppFeaturesSettings>;
  if (typeof input.smsSendingEnabled === 'boolean') {
    base.smsSendingEnabled = input.smsSendingEnabled;
  }
  return base;
}
