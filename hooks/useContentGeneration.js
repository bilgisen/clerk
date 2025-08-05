import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
export function useContentGeneration({ onSuccess, onError } = {}) {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [data, setData] = useState(null);
    const { getToken } = useAuth();
    const generateContent = async (params) => {
        setIsLoading(true);
        setError(null);
        try {
            const token = await getToken();
            const response = await fetch('/api/content/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify(params),
            });
            if (!response.ok) {
                throw new Error('İçerik oluşturulurken bir hata oluştu');
            }
            const result = await response.json();
            setData(result);
            onSuccess?.(result);
            return result;
        }
        catch (err) {
            const error = err instanceof Error ? err : new Error('Beklenmeyen bir hata oluştu');
            setError(error);
            onError?.(error);
            throw error;
        }
        finally {
            setIsLoading(false);
        }
    };
    const checkStatus = async (contentId) => {
        try {
            const token = await getToken();
            const response = await fetch(`/api/content/generate?contentId=${contentId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });
            if (!response.ok) {
                throw new Error('Durum kontrol edilirken bir hata oluştu');
            }
            return await response.json();
        }
        catch (err) {
            const error = err instanceof Error ? err : new Error('Beklenmeyen bir hata oluştu');
            setError(error);
            throw error;
        }
    };
    return {
        generateContent,
        checkStatus,
        isLoading,
        error,
        data,
    };
}
