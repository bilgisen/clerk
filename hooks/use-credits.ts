import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";

// Types
type CreditSummary = {
  success: boolean;
  data: {
    balance: number;
    recentActivities: Array<{
      id: string;
      type: string;
      title: string;
      delta: number;
      ref: string | null;
      createdAt: string;
    }>;
  };
};

type SpendCreditsOptions = {
  action: "book.create" | "publish.epub" | "publish.pdf" | "publish.audio";
  ref?: string;
  words?: number;
};

// Fetch credit summary
async function fetchCreditSummary(signal?: AbortSignal): Promise<CreditSummary> {
  const response = await fetch('/api/credits/summary', { signal });
  if (!response.ok) {
    throw new Error('Failed to fetch credit summary');
  }
  return response.json();
}

// Spend credits
async function spendCreditsRequest(
  { action, ref, words }: SpendCreditsOptions,
  signal?: AbortSignal
) {
  const response = await fetch('/api/credits/consume', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action,
      ref,
      words,
      idempotencyKey: `spend-${action}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    }),
    signal,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to spend credits');
  }

  return response.json();
}

export function useCredits() {
  const { isLoaded, userId } = useAuth();
  const queryClient = useQueryClient();

  // Get credit summary
  const {
    data: creditSummary,
    isLoading: isLoadingSummary,
    error: summaryError,
    refetch: refetchSummary,
  } = useQuery<CreditSummary>({
    queryKey: ['credits', 'summary'],
    queryFn: ({ signal }) => fetchCreditSummary(signal),
    enabled: isLoaded && !!userId,
    refetchOnWindowFocus: false,
  });

  // Get current balance
  const balance = creditSummary?.data?.balance ?? 0;
  const recentActivities = creditSummary?.data?.recentActivities ?? [];

  // Spend credits mutation
  const spendCredits = useMutation({
    mutationFn: (options: SpendCreditsOptions) => spendCreditsRequest(options),
    onSuccess: () => {
      // Invalidate and refetch credit summary
      queryClient.invalidateQueries({ queryKey: ['credits', 'summary'] });
    },
  });

  // Check if user has enough credits
  const hasEnoughCredits = (required: number): boolean => {
    if (!isLoaded || !userId) return false;
    return balance >= required;
  };

  // Get cost for an action
  const getCost = (action: SpendCreditsOptions['action'], words?: number): number => {
    const costs = {
      'book.create': 10,
      'publish.epub': 5,
      'publish.pdf': 5,
      'publish.audio': Math.ceil((words || 0) / 1000) * 1, // 1 credit per 1000 words
    };
    
    return costs[action] || 0;
  };

  return {
    // State
    balance,
    recentActivities,
    isLoading: isLoadingSummary,
    error: summaryError,
    
    // Actions
    spendCredits: spendCredits.mutateAsync,
    isSpending: spendCredits.isPending,
    spendError: spendCredits.error,
    refetch: refetchSummary,
    
    // Helpers
    hasEnoughCredits,
    getCost,
  };
}

// Hook to check if user has enough credits for an action
export function useHasEnoughCredits(action: SpendCreditsOptions['action'], words?: number) {
  const { balance, isLoading } = useCredits();
  
  if (isLoading) return { hasEnough: false, isLoading: true };
  
  const cost = {
    'book.create': 10,
    'publish.epub': 5,
    'publish.pdf': 5,
    'publish.audio': Math.ceil((words || 0) / 1000) * 1, // 1 credit per 1000 words
  }[action] || 0;
  
  return { 
    hasEnough: balance >= cost, 
    isLoading: false,
    cost,
    balance,
  };
}
