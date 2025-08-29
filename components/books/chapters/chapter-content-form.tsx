"use client";

import React, { useState, useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, Controller, type SubmitHandler } from "react-hook-form";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { chapterFormSchema } from "@/schemas/chapter-schema";
import type { ChapterFormValues } from "@/schemas/chapter-schema";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ParentChapterSelect } from "./ParentChapterSelect";
import ChapterContentEditor from './ChapterContentEditor';
import { toast } from "sonner";

export type Chapter = {
  id: string;
  title: string;
  level: number;
  parent_chapter_id?: string | null;
};

type ChapterContentFormProps = {
  initialData?: Partial<ChapterFormValues>;
  parentChapters: Chapter[];
  currentChapterId?: string;
  onSubmit: (values: ChapterFormValues) => Promise<{ success: boolean; redirectUrl?: string }>;
  onChange?: (values: any) => void;
  disabled?: boolean;
  loading?: boolean;
  submitButtonText?: string;
  bookSlug: string;
};

const ChapterContentForm = React.forwardRef<HTMLFormElement, ChapterContentFormProps>(
  ({
    initialData = {},
    parentChapters = [],
    currentChapterId,
    onSubmit: onSubmitProp,
    bookSlug,
    disabled = false,
    loading = false,
    submitButtonText = "Save Chapter",
    onChange,
    ...props
  }, ref) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  
  const defaultValues: ChapterFormValues = {
    title: initialData?.title || "",
    content: initialData?.content || "",
    parent_chapter_id: initialData?.parent_chapter_id ?? null,
    level: initialData?.level ?? 1,
    is_published: initialData?.is_published ?? false,
    book_id: initialData?.book_id ?? "",
    order: initialData?.order ?? 0,
    slug: initialData?.slug ?? "",
    published_at: initialData?.published_at ?? null,
  };

  const form = useForm<ChapterFormValues>({
    // @ts-expect-error - TypeScript has issues with the resolver type from zod
    resolver: zodResolver(chapterFormSchema),
    defaultValues,
    mode: 'onChange',
  });

  // Notify parent component of changes
  useEffect(() => {
    if (typeof onChange === 'function') {
      const subscription = form.watch((value) => {
        onChange(value as ChapterFormValues);
      });
      return () => subscription.unsubscribe();
    }
  }, [form, onChange]);

  const { control, setValue, handleSubmit } = form;

  const handleFormSubmit: SubmitHandler<ChapterFormValues> = async (formData: ChapterFormValues) => {
    try {
      setIsSubmitting(true);
      const result = await onSubmitProp(formData);
      
      if (result?.success) {
        toast.success("Chapter saved successfully");
        if (result.redirectUrl) {
          router.push(result.redirectUrl);
        } else {
          // Fallback to the book's chapters page
          router.push(`/dashboard/books/${bookSlug}/chapters`);
        }
      }
    } catch (error) {
      console.error("Error submitting form:", error);
      toast.error(
        error instanceof Error 
          ? error.message 
          : "An error occurred while saving the chapter."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredParentChapters = React.useMemo(() => 
    (parentChapters || []).filter((chapter: Chapter) => chapter.id !== currentChapterId),
    [parentChapters, currentChapterId]
  );

  const onSubmit = React.useCallback((e: React.FormEvent) => {
    e.preventDefault();
    handleSubmit(handleFormSubmit)(e);
  }, [handleSubmit, handleFormSubmit]);

  return (
    <Form {...form}>
      <form 
        ref={ref}
        onSubmit={onSubmit}
        className="space-y-6"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-muted-foreground/50">Chapter Title</FormLabel>
                <FormControl>
                  <Input 
                    disabled={disabled}
                    placeholder="Enter chapter title"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name="parent_chapter_id"
            render={() => (
              <FormItem>
                <FormLabel className="text-muted-foreground/50">Parent Chapter (Optional)</FormLabel>
                <FormControl>
                  <ParentChapterSelect
                    parentChapters={filteredParentChapters}
                    value={form.watch("parent_chapter_id")}
                    onChange={(value) => setValue("parent_chapter_id", value)}
                    disabled={disabled}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Content Editor */}
        <Controller
          name="content"
          control={control}
          render={({ field: { onChange, value } }) => (
            <FormItem>
              <FormControl>
                <div className="overflow-hidden rounded-md">
                  <ChapterContentEditor
                    name="content"
                    initialContent={(() => {
                      try {
                        return typeof value === 'string' && value.trim().startsWith('{') 
                          ? JSON.parse(value) 
                          : initialData?.content || '';
                      } catch (e) {
                        console.error('Error parsing content:', e);
                        return initialData?.content || '';
                      }
                    })()}
                    onChange={(content) => {
                      try {
                        const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
                        onChange(contentStr);
                      } catch (e) {
                        console.error('Error stringifying content:', e);
                        onChange('');
                      }
                    }}
                    disabled={disabled}
                    placeholder="Start writing your chapter content here..."
                    className="min-h-[400px]"
                  />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={disabled || isSubmitting || loading}
            className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {(isSubmitting || loading) ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              submitButtonText
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
});

ChapterContentForm.displayName = 'ChapterContentForm';

export { ChapterContentForm };
export default ChapterContentForm;
