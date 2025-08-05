"use client"

import { useQuery } from "@tanstack/react-query"
import { Book } from "@/types/book"

interface ApiResponse {
  data: Book[]
  error?: string
}

export function useGetBooks() {
  return useQuery<Book[], Error>({
    queryKey: ["books"],
    queryFn: async (): Promise<Book[]> => {
      const response = await fetch("/api/books")
      if (!response.ok) {
        throw new Error(`Failed to fetch books: ${response.statusText}`)
      }
      const result: ApiResponse = await response.json()
      
      if (result.error) {
        throw new Error(result.error)
      }
      
      return result.data || []
    },
  })
}
