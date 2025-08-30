"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useParams } from 'next/navigation';
import { SerializedEditorState } from "lexical";
import ParentChapterSelect from "@/components/books/chapters/ParentChapterSelect";
import ChapterContentEditor from "@/components/books/chapters/ChapterContentEditor";
import { useForm, type SubmitHandler } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Control } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";
import { BooksMenu } from "@/components/books/books-menu";
import DynamicChapterContentEditor from "@/components/books/chapters/DynamicChapterContentEditor";

// Define chapter type for parent chapter selection
interface Chapter {
  id: string;
  title: string;
  level?: number;
  parentId?: string;
}

// Define base form schema with all required fields
const baseFormSchema = {
  title: z.string().min(1, "Title is required"),
  content: z.union([
    z.string().min(1, "Content is required"),
    z.record(z.any(), z.any()).refine(val => val !== null && typeof val === 'object', {
      message: "Content is required"
    })
  ]),
  parent_chapter_id: z.string().nullable().optional(),
  order: z.number().default(0),
  isDraft: z.boolean().default(true)
} as const;

// Create form schema with proper typing
const formSchema = z.object({
  title: z.string().min(1, "Title is required"),
  content: z.union([
    z.string().min(1, "Content is required"),
    z.record(z.any(), z.any()).refine(val => val !== null && typeof val === 'object', {
      message: "Content is required"
    })
  ]),
  parent_chapter_id: z.string().nullable().optional(),
  order: z.number().default(0),
  isDraft: z.boolean().default(true)
});

type FormValues = z.infer<typeof formSchema>;

// Define form control type
type FormControlType = Control<FormValues>;

export default function NewChapterPage() {
  const router = useRouter();
  const params = useParams<{ slug: string }>();
  const bookSlug = params?.slug as string;

  const [isLoading, setIsLoading] = React.useState<boolean>(true);
  const [chapters, setChapters] = React.useState<Chapter[]>([]);
  const [bookName, setBookName] = React.useState<string>('');
  const [bookId, setBookId] = React.useState<string>('');
  
  // Load book and chapters data
  React.useEffect(() => {
    const loadData = async () => {
      if (!bookSlug) return;
      
      setIsLoading(true);
      try {
        // Load book details
        const bookResponse = await fetch(`/api/books/by-slug/${bookSlug}`);
        if (!bookResponse.ok) throw new Error('Failed to load book details');
        const bookData = await bookResponse.json();
        setBookName(bookData.title || 'this book');
        setBookId(bookData.id || '');

        // Load chapters
        const chaptersResponse = await fetch(`/api/books/by-slug/${bookSlug}/chapters`);
        if (!chaptersResponse.ok) throw new Error('Failed to load chapters');
        const chaptersData = await chaptersResponse.json();
        
        // Transform the data to match the Chapter type
        const formattedChapters = chaptersData.map((chapter: any) => ({
          id: chapter.id,
          title: chapter.title,
          level: chapter.level || 0,
          parentId: chapter.parent_chapter_id || undefined,
        }));
        
        setChapters(formattedChapters);
      } catch (error) {
        console.error('Error loading data:', error);
        toast.error('Failed to load data');
      } finally {
        setIsLoading(false);
      }
    };
    
    loadData();
  }, [bookSlug]);

  // Initialize form with explicit type and default values
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      title: "",
      content: JSON.stringify({
        root: {
          children: [{
            children: [{
              text: "",
              type: "text" as const,
              detail: 0,
              format: 0,
              mode: "normal" as const,
              style: "",
              version: 1
            }],
            direction: "ltr" as const,
            format: "",
            indent: 0,
            type: "paragraph" as const,
            version: 1
          }],
          direction: "ltr" as const,
          format: "",
          indent: 0,
          type: "root" as const,
          version: 1
        }
      }),
      parent_chapter_id: null,
      order: 0,
      isDraft: true,
    },
  });

  // Prepare parent chapter options
  const parentChapterOptions = React.useMemo(() => 
    chapters
      .filter((chapter: Chapter) => chapter.id !== bookSlug) // Exclude current book if needed
      .map((chapter: Chapter) => ({
        id: chapter.id,
        title: chapter.title,
        level: chapter.level || 0,
      })),
    [chapters, bookSlug]
  );

  const onSubmit: SubmitHandler<FormValues> = async (values) => {
    try {
      setIsLoading(true)
      
      // Content is already a string from the form, but ensure it's valid JSON
      let contentToSend = values.content;
      try {
        // If it's a string, parse it to validate it's valid JSON
        if (typeof contentToSend === 'string') {
          JSON.parse(contentToSend);
        } else {
          // If it's not a string, stringify it
          contentToSend = JSON.stringify(contentToSend);
        }
      } catch (e) {
        console.error('Invalid content format:', e);
        toast.error('Invalid content format. Please try again.');
        return;
      }

      const response = await fetch(`/api/books/by-slug/${bookSlug}/chapters`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...values,
          content: contentToSend
        }),
      })

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create chapter');
      }
      
      const newChapter = await response.json();
      
      // Redirect to the new chapter
      router.push(`/dashboard/books/${bookSlug}/chapters/${newChapter.id}`);
      toast.success('Chapter created successfully');
      return { success: true };
    } catch (error) {
      console.error("Error creating chapter:", error);
      toast.error(error instanceof Error ? error.message : 'Failed to create chapter');
      return { success: false };
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-background">
      <main className="container mx-auto py-8 px-4">
        <div className="max-w-full mx-auto">
          <div className="mb-6">
            <div className="flex justify-between items-center">
              <h1 className="text-3xl font-bold">Create New Chapter</h1>
              <BooksMenu slug={bookSlug} bookId={bookId} />
            </div>
            <p className="text-muted-foreground mt-2">
              Add a new chapter to <span className="font-medium">{bookName || 'this book'}</span>
            </p>
          </div>
          <Separator className="mb-6" />
          <Form {...form as any}>
            <form onSubmit={form.handleSubmit(onSubmit as any)} className="space-y-6">
              <div className="space-y-6">
                {/* Title Field */}
                <div>
                  <FormField<FormValues>
                    control={form.control as unknown as Control<FormValues>}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-muted-foreground">Chapter Title</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter chapter title" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Parent Chapter Select */}
                <div className="pt-2">
                  <FormField<FormValues>
                    control={form.control as unknown as Control<FormValues>}
                    name="parent_chapter_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-muted-foreground">Parent Chapter (Optional)</FormLabel>
                        <FormControl>
                          <ParentChapterSelect
                            parentChapters={parentChapterOptions}
                            value={field.value || null}
                            onChange={field.onChange}
                            placeholder="Select a parent chapter (optional)"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Content Editor */}
                <div className="pt-2">
                  <FormField<FormValues>
                  control={form.control as unknown as Control<FormValues>}
                  name="content"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-muted-foreground">Chapter Content</FormLabel>
                      <FormControl>
                        <div className="overflow-hidden">
                          <DynamicChapterContentEditor
                            name="content"
                            initialContent={(() => {
                              try {
                                if (!field.value) return undefined;
                                const content = typeof field.value === 'string' 
                                  ? JSON.parse(field.value) 
                                  : field.value;
                                // Ensure the content matches the expected SerializedEditorState type
                                return content?.root ? content as SerializedEditorState : undefined;
                              } catch (e) {
                                console.error('Error parsing initial content:', e);
                                return undefined; // Will use default from component
                              }
                            })()}
                            onChange={(newContent) => {
                              form.setValue('content', newContent);
                            }}
                            disabled={form.formState.isSubmitting}
                            placeholder="Start writing your chapter content here..."
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex justify-end space-x-4 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push(`/dashboard/books/${bookSlug}/chapters`)}
                  disabled={form.formState.isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={form.formState.isSubmitting}
                >
                  {form.formState.isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Chapter'
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </main>
    </div>
  );
}