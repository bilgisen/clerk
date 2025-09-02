import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth-client";

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
  const response = await fetch('/api/credits/summary', { 
    signal,
    credentials: 'include' // Include cookies for authentication
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to fetch credit summary');
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
    credentials: 'include', // Include cookies for authentication
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
  const { user, isAuthenticated, loading } = useAuth();
  const authLoading = loading; // Alias for consistency with existing code
  const queryClient = useQueryClient();

  // Get credit summary
  const {
    data: creditSummary,
    isLoading: isLoadingSummary,
    error: summaryError,
    refetch: refetchSummary,
  } = useQuery<CreditSummary>({
    queryKey: ['credits', 'summary', user?.id],
    queryFn: ({ signal }) => fetchCreditSummary(signal),
    enabled: !authLoading && isAuthenticated,
    refetchOnWindowFocus: false,
    retry: 1,
    staleTime: 5 * 60 * 1000, // 5 minutes
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
    if (authLoading || !isAuthenticated) return false;
    return balance >= required;
  };

  // Get cost for an action
  const getCost = (action: SpendCreditsOptions['action'], words?: number): number => {
    const costs = {
      'book.create': 10,
      'publish.epub': 5,
      'publish.pdf': 5,
      'publish.audio': Math.ceil((words || 0) / 1000) * 1, // 1 credit per 1000 words
    } as const;
    
    return costs[action] || 0;
  };

  return {
    // State
    balance,
    recentActivities,
    isLoading: isLoadingSummary || authLoading,
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
export function useHasEnoughCredits(
  action: SpendCreditsOptions['action'], 
  words?: number
) {
  const { balance, isLoading, error } = useCredits();
  
  const cost = getActionCost(action, words);
  
  return { 
    hasEnough: !isLoading && balance >= cost,
    isLoading,
    cost,
    balance,
    error,
  };
}

// Helper function to calculate action cost
function getActionCost(
  action: SpendCreditsOptions['action'], 
  words?: number
): number {
  const costs = {
    'book.create': 10,
    'publish.epub': 5,
    'publish.pdf': 5,
    'publish.audio': Math.ceil((words || 0) / 1000) * 1, // 1 credit per 1000 words
  } as const;
  
  return costs[action] || 0;
}
