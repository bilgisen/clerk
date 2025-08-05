"use client";

import React from "react";
import { useRouter, useParams } from "next/navigation";
import ChapterContentEditor from "@/components/books/chapters/ChapterContentEditor";
import { ParentChapterSelect } from "@/components/books/chapters/ParentChapterSelect";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";

// Define chapter type for parent chapter selection
interface Chapter {
  id: string;
  title: string;
  level?: number;
  parentId?: string;
}

// Define form schema
const formSchema = z.object({
  title: z.string().min(1, "Title is required"),
  content: z.string().min(1, "Content is required"),
  parent_chapter_id: z.string().nullable().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function NewChapterPage() {
  const router = useRouter();
  const params = useParams<{ slug: string }>();
  const bookSlug = params.slug;

  // Get book data
  // Mock data for now - replace with actual data fetching
  const [isLoading, setIsLoading] = React.useState<boolean>(false);
  const [chapters, setChapters] = React.useState<Chapter[]>([]);
  
  // Load chapters
  React.useEffect(() => {
    const loadChapters = async () => {
      if (!bookSlug) return;
      
      setIsLoading(true);
      try {
        const response = await fetch(`/api/books/by-slug/${bookSlug}/chapters`);
        if (!response.ok) throw new Error('Failed to load chapters');
        const data = await response.json();
        
        // Transform the data to match the Chapter type
        const formattedChapters = data.map((chapter: any) => ({
          id: chapter.id,
          title: chapter.title,
          level: chapter.level || 0,
          parentId: chapter.parent_chapter_id || undefined,
        }));
        
        setChapters(formattedChapters);
      } catch (error) {
        console.error('Error loading chapters:', error);
        toast.error('Failed to load chapters');
      } finally {
        setIsLoading(false);
      }
    };
    
    loadChapters();
  }, [bookSlug]);

  // Initialize form
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      content: "",
      parent_chapter_id: null,
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

  const onSubmit = async (values: FormValues) => {
    if (!bookSlug) return { success: false };
    
    try {
      setIsLoading(true);
      
      const response = await fetch(`/api/books/by-slug/${bookSlug}/chapters`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: values.title,
          content: values.content,
          parent_chapter_id: values.parent_chapter_id || null,
          order: chapters.length, // Add to the end by default
          level: values.parent_chapter_id ? 1 : 0, // Set level based on parent
          isDraft: false,
        }),
      });
      
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
    <div className="min-h-screen bg-background">
      <main className="container mx-auto py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-6">Create New Chapter</h1>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Title Field */}
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Chapter Title</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter chapter title" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Parent Chapter Select */}
              <FormField
                control={form.control}
                name="parent_chapter_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Parent Chapter (Optional)</FormLabel>
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

              {/* Content Editor */}
              <FormField
                control={form.control}
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Chapter Content</FormLabel>
                    <FormControl>
                      <div className="border rounded-md overflow-hidden">
                        <ChapterContentEditor
                          name="content"
                          initialContent={field.value}
                          onChange={field.onChange}
                          className="min-h-[400px] p-4"
                          placeholder="Start writing your chapter content here..."
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

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