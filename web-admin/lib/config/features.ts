export function isPreparationEnabled(): boolean {
  return process.env.NEXT_PUBLIC_FEATURE_PREPARATION === 'true';
}


