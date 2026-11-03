let latestIntentSeq = 0;

export function beginNavigationIntent(): number {
  latestIntentSeq += 1;
  return latestIntentSeq;
}

export function getNavigationIntent(): number {
  return latestIntentSeq;
}

export function isLatestNavigationIntent(intentSeq: number): boolean {
  return intentSeq === latestIntentSeq;
}