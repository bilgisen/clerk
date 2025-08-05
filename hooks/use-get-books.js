"use client";
import { useQuery } from "@tanstack/react-query";
export function useGetBooks() {
    return useQuery({
        queryKey: ["books"],
        queryFn: async () => {
            const response = await fetch("/api/books");
            if (!response.ok) {
                throw new Error(`Failed to fetch books: ${response.statusText}`);
            }
            const result = await response.json();
            if (result.error) {
                throw new Error(result.error);
            }
            return result.data || [];
        },
    });
}
