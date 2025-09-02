// components/forms/image-upload-field.tsx
"use client";

import toast from "sonner";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import Image from "next/image";
import { useState, useRef } from "react";

export function ImageUploadField({
  value,
  onChange,
}: {
  value?: string;
  onChange: (url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const xhrRef = useRef<XMLHttpRequest | null>(null); // Ref to hold the XMLHttpRequest instance

  const handleChange = (file: File) => {
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Only image files are allowed");
      return;
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      toast.error("Maksimum dosya boyutu 5MB'dır");
      return;
    }

    // Set uploading state
    setUploading(true);
    setProgress(0);

    const formData = new FormData();
    formData.append("file", file);

    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr; // Store the XHR instance in the ref

    // Setup progress tracking
    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        const percentComplete = Math.round((event.loaded / event.total) * 100);
        setProgress(percentComplete);
      }
    });

    // Handle upload completion
    xhr.addEventListener("load", () => {
      if (xhr.status === 200) {
        try {
          const data = JSON.parse(xhr.responseText);
          setProgress(100);
          onChange(data.url);
          toast.success("Resim başarıyla yüklendi");
        } catch (e) {
          console.error("Failed to parse response JSON", e);
          toast.error('Sunucudan gelen yanıt işlenemedi');
        }
      } else {
        let errorMessage = 'Dosya yüklenirken bir hata oluştu';
        try {
          const errorData = JSON.parse(xhr.responseText);
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          // If parsing fails, use generic message or status text
          errorMessage = xhr.statusText || errorMessage;
        }
        toast.error(errorMessage);
      }
      setUploading(false);
      setProgress(0);
    });

    // Handle network or other errors
    xhr.addEventListener("error", () => {
      toast.error("Yükleme sırasında bir ağ hatası oluştu");
      setUploading(false);
      setProgress(0);
    });

    // Handle abort (e.g., if user cancels)
    xhr.addEventListener("abort", () => {
      toast.info("Yükleme iptal edildi");
      setUploading(false);
      setProgress(0);
    });

    xhr.open("POST", "/api/upload", true);
    xhr.send(formData);
  };

  // Handles file input change
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleChange(file);
    }
  };

  // Handles drag and drop events
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const files = e.dataTransfer.files;
    if (files && files[0]) {
      handleChange(files[0]);
    }
  };

  // Removes the uploaded image
  const handleRemove = () => {
    // Abort the request if it's in progress
    if (xhrRef.current && uploading) {
      xhrRef.current.abort();
    }
    onChange("");
    setProgress(0);
  };

  return (
    <div className="space-y-2">
      <div
        className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-colors flex flex-col items-center justify-center ${
          dragActive
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-muted-foreground/50"
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        {!value && (
          <>
            <Input
              type="file"
              accept="image/*"
              onChange={handleFileInputChange}
              disabled={uploading}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className="flex flex-col items-center space-y-2 pointer-events-none">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mx-auto text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h10a4 4 0 004-4M7 10l5-5m0 0l5 5m-5-5v12" />
              </svg>
              <span className="font-medium">Click to upload or drag and drop</span>
              <span className="text-xs text-muted-foreground">PNG, JPG, GIF up to 5MB</span>
            </div>
          </>
        )}
        {value && (
          <div className="relative inline-block">
            <Image
              src={value}
              alt="Uploaded image"
              width={180}
              height={180}
              className="rounded border object-cover"
            />
            <button
              type="button"
              onClick={handleRemove}
              disabled={uploading} // Disable remove button while uploading
              className={`absolute top-1 right-1 rounded-full p-1 shadow ${
                uploading 
                  ? "bg-gray-300 cursor-not-allowed" 
                  : "bg-white/80 hover:bg-white"
              }`}
              aria-label="Remove image"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
        {uploading && <Progress value={progress} className="h-1 mt-4" />}
      </div>
    </div>
  );
}