// components/forms/image-upload-field.tsx
"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { uploadImage } from "@/actions/upload-image";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import Image from "next/image";
import { useState } from "react";

export function ImageUploadField({
  value,
  onChange,
}: {
  value?: string;
  onChange: (url: string) => void;
}) {
  const [uploading, startUpload] = useTransition();
  const [progress, setProgress] = useState(0);

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Only image files allowed");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Max file size is 5MB");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    // Create a properly typed form data object
    const typedFormData = formData as FormData & {
      get: (name: 'file') => File | null;
    };

    setProgress(0);

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) {
          clearInterval(interval);
          return prev;
        }
        return prev + Math.random() * 15;
      });
    }, 200);

    startUpload(async () => {
      try {
        const { url } = await uploadImage(typedFormData);
        clearInterval(interval);
        setProgress(100);
        onChange(url);
        toast.success("Image uploaded");
      } catch (error) {
        console.error("Upload failed:", error);
        clearInterval(interval);
        toast.error("Upload failed");
      } finally {
        setProgress(0);
      }
    });
  };

  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const files = e.dataTransfer.files;
    if (files && files[0]) {
      const event = {
        target: { files }
      } as unknown as React.ChangeEvent<HTMLInputElement>;
      handleChange(event);
    }
  };

  const handleRemove = () => {
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
              onChange={handleChange}
              disabled={uploading}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className="flex flex-col items-center space-y-2 pointer-events-none">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mx-auto text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h10a4 4 0 004-4M7 10l5-5m0 0l5 5m-5-5v12" /></svg>
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
              className="absolute top-1 right-1 bg-white/80 hover:bg-white rounded-full p-1 shadow"
              aria-label="Remove image"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        )}
        {uploading && <Progress value={progress} className="h-1 mt-4" />}
      </div>
    </div>
  );
}
