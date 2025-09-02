import { useState, useCallback } from 'react';
import toast from "sonner";

type UploadResult = {
  url: string;
  key: string;
};

export function useR2ImageUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const uploadImage = useCallback(async (file: File): Promise<UploadResult | null> => {
    if (!file.type.startsWith('image/')) {
      toast.error('Only image files are allowed');
      return null;
    }

    // 5MB limit
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return null;
    }

    const formData = new FormData();
    formData.append('file', file);
    
    // Generate a unique key for the file
    const key = `images/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, '')}`;
    
    try {
      setIsUploading(true);
      setProgress(0);
      
      // Simulate progress
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + Math.random() * 15;
        });
      }, 200);
      
      const response = await fetch('/api/upload/image', {
        method: 'POST',
        body: formData,
        headers: {
          'X-File-Key': key,
        },
      });
      
      clearInterval(progressInterval);
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'Failed to upload image');
      }
      
      const result = await response.json();
      setProgress(100);
      toast.success('Image uploaded successfully');
      
      return {
        url: result.url,
        key: result.key,
      };
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to upload image');
      return null;
    } finally {
      setIsUploading(false);
      setTimeout(() => setProgress(0), 500);
    }
  }, [setIsUploading, setProgress, toast]);

  return {
    uploadImage,
    isUploading,
    progress,
  };
}
