"use client";

import React, { useState } from "react";
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
import dynamic from 'next/dynamic';

const SimpleEditor = dynamic<{
  content: string;
  onChange: (content: string) => void;
  className?: string;
  editorProps?: {
    attributes?: {
      class?: string;
      'data-placeholder'?: string;
    };
  };
}>(
  () => import('@/components/tiptap-templates/simple/simple-editor').then(mod => mod.SimpleEditor),
  { ssr: false }
);
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
  disabled?: boolean;
  loading?: boolean;
  submitButtonText?: string;
  bookSlug: string;
};

const ChapterContentForm = React.forwardRef<HTMLFormElement, ChapterContentFormProps>(
  (
    {
      initialData,
      parentChapters,
      currentChapterId,
      onSubmit: onSubmitProp,
      bookSlug,
      disabled = false,
      loading = false,
      submitButtonText = "Save Chapter",
    },
    ref
  ) => {
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
    resolver: zodResolver(chapterFormSchema) as any, // Type assertion to handle resolver type mismatch
    defaultValues,
  });

  const { control, watch, setValue } = form;

  const handleFormSubmit: SubmitHandler<ChapterFormValues> = async (formData) => {
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

  const filteredParentChapters = parentChapters.filter(
    (chapter) => chapter.id !== currentChapterId
  );

  const handleSubmit = form.handleSubmit(handleFormSubmit);

  return (
    <Form {...form}>
      <form 
        ref={ref}
        onSubmit={(e) => {
          e.preventDefault();
          void handleSubmit(e);
        }}
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
                    value={watch("parent_chapter_id")}
                    onChange={(value) => setValue("parent_chapter_id", value)}
                    disabled={disabled}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Content with Tiptap */}
        <Controller
          name="content"          
          control={control}
          render={({ field: { onChange, value } }) => (
            <FormItem>
              <FormControl>
                    <div className="min-h-[300px] overflow-hidden rounded-md border">
                      <SimpleEditor
                        content={value || ''}
                        onChange={(content) => onChange(content)}
                        className="h-full min-h-[300px] p-4"
                        editorProps={{
                          attributes: {
                            class: 'prose dark:prose-invert max-w-none focus:outline-none',
                            'data-placeholder': 'Start writing your chapter content here...'
                          }
                        }}
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
            className="w-full sm:w-auto"
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
