export const ACTIONS_STORAGE_KEY = 'sy-finance:account-actions';

export type AccountContribution = {
  id: string;
  label: string;
  amount: number;
  kind: 'deposit' | 'withdrawal';
  date: string;
  cadence: 'monthly' | 'one-time';
};

export type ContributionFormState = {
  label: string;
  amount: string;
  date: string;
  kind: 'deposit' | 'withdrawal';
  cadence: 'monthly' | 'one-time';
};

export function readStoredActions(): Record<string, AccountContribution[]> {
  if (typeof window === 'undefined') {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(ACTIONS_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as Record<string, AccountContribution[]>;
    if (parsed && typeof parsed === 'object') {
      return Object.entries(parsed).reduce<Record<string, AccountContribution[]>>((acc, [key, value]) => {
        if (!Array.isArray(value)) {
          return acc;
        }
        acc[key] = value.map((item) => ({
          ...item,
          cadence: item.cadence === 'one-time' ? 'one-time' : 'monthly'
        }));
        return acc;
      }, {});
    }
  } catch {
    // ignore corrupted data
  }
  return {};
}

export function persistStoredActions(data: Record<string, AccountContribution[]>) {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(ACTIONS_STORAGE_KEY, JSON.stringify(data));
}

export function createLocalId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 10);
}

export function createContributionDraft(): ContributionFormState {
  return {
    label: '',
    amount: '',
    date: new Date().toISOString().slice(0, 10),
    kind: 'deposit',
    cadence: 'monthly'
  };
}

export function calculateTrackedCapital(contributions: AccountContribution[]): number {
  return contributions.reduce((sum, contribution) => {
    const direction = contribution.kind === 'withdrawal' ? -1 : 1;
    return sum + direction * contribution.amount;
  }, 0);
}
