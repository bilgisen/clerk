"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useForm, Controller, useWatch, type Control, FieldValues, SubmitHandler, UseFormReturn, FieldErrors, UseFormHandleSubmit, UseFormRegister, UseFormSetValue } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { ImageUploadField } from "@/components/books/forms/image-upload-field";
import slugify from "slugify";
import type { Book } from "@/types/book";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Define the book genre enum as a constant to avoid repetition
const BOOK_GENRES = [
  'FICTION', 'NON_FICTION', 'SCIENCE_FICTION', 'FANTASY', 'ROMANCE',
  'THRILLER', 'MYSTERY', 'HORROR', 'BIOGRAPHY', 'HISTORY', 'SELF_HELP',
  'CHILDREN', 'YOUNG_ADULT', 'COOKBOOK', 'TRAVEL', 'HUMOR', 'POETRY',
  'BUSINESS', 'TECHNOLOGY', 'SCIENCE', 'PHILOSOPHY', 'RELIGION', 'OTHER'
] as const;

type BookGenreType = typeof BOOK_GENRES[number];

const bookSchema = z.object({
  // Required fields
  title: z.string().min(1, { message: "Title is required" }),
  author: z.string().min(1, { message: "Author is required" }),
  publisher: z.string().min(1, { message: "Publisher is required" }),
  contributor: z.string().optional(),
  translator: z.string().optional(),
  
  // Auto-generated fields
  slug: z.string().optional(),
  
  // Optional fields with validation
  subtitle: z.string().optional(),
  description: z.string().optional(),
  publisherWebsite: z
    .string()
    .url({ message: "Invalid URL" })
    .or(z.literal(""))
    .optional(),
  publishYear: z.coerce
    .number()
    .int()
    .min(1000, { message: "Year must be at least 1000" })
    .max(new Date().getFullYear() + 1, { message: "Year cannot be in the future" })
    .optional(),
  isbn: z.string()
    .regex(/^(\d{10}|\d{13})$/, { message: "Invalid ISBN format (must be 10 or 13 digits)" })
    .or(z.literal(""))
    .optional(),
  language: z.string()
    .length(2, { message: "Must be a 2-letter language code" })
    .default("tr")
    .optional(),
  genre: z.enum(BOOK_GENRES).optional(),
  series: z.string().optional(),
  seriesIndex: z.coerce
    .number()
    .int()
    .min(1, { message: "Series index must be at least 1" })
    .optional(),
  tags: z.array(z.string()).optional(),
  coverImageUrl: z.string()
    .url({ message: "Invalid image URL" })
    .or(z.literal(""))
    .optional(),
  isPublished: z.boolean().default(false).optional(),
  isFeatured: z.boolean().default(false).optional(),
});

// First define the form schema type
type BookFormSchema = z.infer<typeof bookSchema>;

// Create a type that makes all fields required and non-nullable for the form
type NonNullableFields<T> = {
  [P in keyof T]-?: NonNullable<T[P]>;
};

// Define the form values type based on the schema but make all fields required
// This ensures type safety with the form while allowing for optional fields in the UI
type FormValues = NonNullableFields<{
  title: string;
  author: string;
  publisher: string;
  contributor?: string;
  translator?: string;
  slug: string;
  subtitle?: string;
  description?: string;
  publisherWebsite?: string;
  publishYear?: number;
  isbn?: string;
  language: string;
  genre?: BookGenreType;
  series?: string;
  seriesIndex?: number;
  tags?: string[];
  coverImageUrl?: string;
  isPublished: boolean;
  isFeatured: boolean;
}>;

export type BookFormValues = FormValues;

interface LanguageOption {
  value: string;
  label: string;
}

const languageOptions: LanguageOption[] = [
  { value: 'tr', label: 'Türkçe' },
  { value: 'en', label: 'English' },
  { value: 'de', label: 'Deutsch' },
  { value: 'fr', label: 'Français' },
  { value: 'es', label: 'Español' },
];

interface BookInfoFormProps {
  /** Callback when the form is submitted with valid data */
  onSubmit: SubmitHandler<BookFormValues>;
  
  /** Initial form values */
  defaultValues?: Partial<BookFormValues>;
  
  /** Whether the form is currently submitting */
  isSubmitting?: boolean;
}

export function BookInfoForm({
  onSubmit,
  defaultValues,
  isSubmitting = false,
}: BookInfoFormProps) {
  // Initialize form with type-safe defaults
  const formMethods = useForm<BookFormValues>({
    resolver: zodResolver(bookSchema) as any, // Type assertion needed due to complex type inference
    defaultValues: {
      title: '',
      slug: '',
      author: '',
      publisher: '',
      language: 'tr',
      isPublished: false,
      isFeatured: false,
      ...defaultValues,
    } as BookFormValues,
    mode: 'onChange',
  });

  // Destructure form methods
  const { 
    register, 
    handleSubmit, 
    control, 
    setValue, 
    formState: { errors } 
  } = formMethods;

  const titleValue = useWatch({ control, name: "title" });

  /**
   * Generate a URL-friendly slug from the book title
   */
  const generateSlug = useCallback((title: string): string => {
    return slugify(title, { 
      lower: true, 
      strict: true,
      trim: true,
      remove: /[*+~.()'"!:@]/g
    });
  }, []);

  // Update slug when title changes
  useEffect(() => {
    if (titleValue && typeof titleValue === 'string') {
      const generatedSlug = generateSlug(titleValue);
      setValue("slug", generatedSlug, { 
        shouldValidate: true,
        shouldDirty: true,
        shouldTouch: true
      });
    }
  }, [titleValue, setValue, generateSlug]);

  const [loading, setLoading] = useState(false);

  const handleFormSubmit = async (data: BookFormValues) => {
    setLoading(true);
    await onSubmit(data);
    setLoading(false);
  };

  // Handle tags input
  const [tagInput, setTagInput] = useState("");
  const tags: string[] = useWatch({ control, name: "tags" }) || [];

  const addTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      const newTag = tagInput.trim();
      if (!tags.includes(newTag)) {
        setValue('tags', [...tags, newTag]);
      }
      setTagInput("");
    }
  };

  const removeTag = (tagToRemove: string) => {
    setValue('tags', tags.filter((tag: string) => tag !== tagToRemove));
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6" aria-busy={isSubmitting}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Title & Subtitle */}
          <div>
            <div className="mb-1">
              <label className="block text-sm font-medium text-muted-foreground/50">Title *</label>
              <input
                type="text"
                {...register("title")}
                className="w-full border px-3 py-2 rounded text-md mt-1"
                placeholder="Book title"
              />
              {errors.title && <p className="text-red-500 text-sm mt-1">{errors.title.message}</p>}
            </div>
            <div className="mt-3">
              <label className="block text-sm font-medium text-muted-foreground/50">Subtitle</label>
              <input
                type="text"
                {...register("subtitle")}
                className="w-full border px-3 py-2 rounded text-md mt-1"
                placeholder="Optional subtitle"
              />
            </div>
          </div>

          {/* Author Information */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-muted-foreground/50">Author *</label>
                <input
                  type="text"
                  {...register("author")}
                  className="w-full border px-3 py-2 rounded text-md mt-1"
                  placeholder="Author name"
                />
                {errors.author && <p className="text-red-500 text-sm mt-1">{errors.author.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-muted-foreground/50">Publisher</label>
                <input
                  type="text"
                  {...register("publisher")}
                  className="w-full border px-3 py-2 rounded text-md mt-1"
                  placeholder="Publisher name"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-muted-foreground/50">Contributor</label>
                <input
                  type="text"
                  {...register("contributor")}
                  className="w-full border px-3 py-2 rounded text-md mt-1"
                  placeholder="Contributor name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted-foreground/50">Translator</label>
                <input
                  type="text"
                  {...register("translator")}
                  className="w-full border px-3 py-2 rounded text-md mt-1"
                  placeholder="Translator name"
                />
              </div>
            </div>
          </div>

          {/* Publisher Website & ISBN */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground/50">Publisher Website</label>
              <input
                type="url"
                {...register("publisherWebsite")}
                className="w-full border px-3 py-2 rounded text-md mt-1"
                placeholder="https://example.com"
              />
              {errors.publisherWebsite && <p className="text-red-500 text-sm mt-1">{errors.publisherWebsite.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground/50">ISBN</label>
              <input
                type="text"
                {...register("isbn")}
                className="w-full border px-3 py-2 rounded text-md mt-1"
                placeholder="10 or 13 digit ISBN"
              />
              {errors.isbn && <p className="text-red-500 text-sm mt-1">{errors.isbn.message}</p>}
            </div>
          </div>

          {/* Series & Genre */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground/50">Series</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  {...register("series")}
                  className="flex-1 border px-3 py-2 rounded text-md mt-1 bg-background text-foreground"
                  placeholder="Series name"
                />
                <div className="w-20">
                  <label className="block text-sm font-medium text-muted-foreground/50 text-center">#</label>
                  <input
                    type="number"
                    min="1"
                    {...register("seriesIndex")}
                    className="w-full border px-3 py-2 rounded text-md mt-1 text-center"
                    placeholder="1"
                  />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <label htmlFor="genre" className="block text-sm font-medium text-foreground">
                Genre
              </label>
              <Controller
                name="genre"
                control={control}
                render={({ field }) => {
                  // Ensure the value is a valid BookGenreType or undefined
                  const value = field.value as BookGenreType | undefined;
                  
                  return (
                    <div>
                      <Select 
                        onValueChange={(val: BookGenreType) => field.onChange(val)}
                        value={value}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select a genre" />
                        </SelectTrigger>
                        <SelectContent>
                          {([
                            'FICTION', 'NON_FICTION', 'SCIENCE_FICTION', 'FANTASY', 'ROMANCE',
                            'THRILLER', 'MYSTERY', 'HORROR', 'BIOGRAPHY', 'HISTORY', 'SELF_HELP',
                            'CHILDREN', 'YOUNG_ADULT', 'COOKBOOK', 'TRAVEL', 'HUMOR', 'POETRY',
                            'BUSINESS', 'TECHNOLOGY', 'SCIENCE', 'PHILOSOPHY', 'RELIGION', 'OTHER'
                          ] as const).map((genre) => (
                            <SelectItem key={genre} value={genre}>
                              {genre.split('_').map(word => word.charAt(0) + word.slice(1).toLowerCase()).join(' ')}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors.genre && (
                        <p className="text-red-500 text-sm mt-1">{errors.genre.message}</p>
                      )}
                    </div>
                  );
                }}
              />
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-muted-foreground/50">Tags</label>
            <div className="mt-1 flex flex-wrap gap-2 border rounded p-2 min-h-[42px]">
              {tags?.map((tag) => (
                <span 
                  key={tag} 
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="ml-1.5 inline-flex items-center justify-center h-4 w-4 rounded-full text-blue-400 hover:bg-blue-200 hover:text-blue-500 focus:outline-none"
                  >
                    <span className="sr-only">Remove tag</span>
                    <svg className="h-2 w-2" stroke="currentColor" fill="none" viewBox="0 0 8 8">
                      <path strokeLinecap="round" strokeWidth="1.5" d="M1 1l6 6m0-6L1 7" />
                    </svg>
                  </button>
                </span>
              ))}
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={addTag}
                className="flex-1 border-0 p-0 text-sm focus:ring-0"
                placeholder="Add a tag and press Enter"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-muted-foreground/50">Description</label>
            <textarea
              {...register("description")}
              rows={5}
              className="w-full border px-3 py-2 rounded text-md mt-1"
              placeholder="A brief description of the book"
            />
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Cover Image */}
          <div>
            <label className="block text-sm font-medium text-muted-foreground/50 mb-2">Cover Image</label>
            <Controller
              name="coverImageUrl"
              control={control}
              render={({ field }) => (
                <ImageUploadField 
                  value={field.value || ''} 
                  onChange={(url: string) => field.onChange(url)}
                />
              )}
            />
            {errors.coverImageUrl && (
              <p className="text-red-500 text-sm mt-1">{errors.coverImageUrl.message}</p>
            )}
          </div>

{/* Language */}
          <div>
            <label htmlFor="language" className="block text-sm font-medium text-muted-foreground/50">
              Language
            </label>
            <select
              id="language"
              {...register("language")}
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
            >
              {languageOptions.map((lang) => (
                <option key={lang.value} value={lang.value}>
                  {lang.label}
                </option>
              ))}
            </select>
          </div>

          {/* Publish Year */}
          <div>
            <label className="block text-sm font-medium text-muted-foreground/50">Publish Year</label>
            <input
              type="number"
              min="1000"
              max={new Date().getFullYear() + 1}
              {...register("publishYear")}
              className="w-full border px-3 py-2 rounded text-md mt-1"
              placeholder={new Date().getFullYear().toString()}
            />
            {errors.publishYear && <p className="text-red-500 text-sm mt-1">{errors.publishYear.message}</p>}
          </div>

          {/* Submit Button */}
          <div className="pt-4">
            <button
              type="submit"
              disabled={isSubmitting || loading}
              className={`px-4 py-2 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                (isSubmitting || loading) ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {(isSubmitting || loading) ? 'Saving...' : 'Save Book'}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
