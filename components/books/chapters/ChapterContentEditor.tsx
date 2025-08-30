"use client"

import React, { useState, useEffect } from "react"
import { SerializedEditorState } from "lexical"
import { cn } from "@/lib/services/utils"
import { Editor } from "@/components/blocks/editor-x/editor"
import { useFormContext, Controller } from 'react-hook-form'

// Helper types for better type safety
type TextNode = {
  detail: number;
  format: number;
  mode: string;
  style: string;
  text: string;
  type: 'text';
  version: 1;
};

type ParagraphNode = {
  children: TextNode[];
  direction: 'ltr' | 'rtl';
  format: string;
  indent: number;
  type: 'paragraph';
  version: 1;
};

const createDefaultTextNode = (text = ''): TextNode => ({
  detail: 0,
  format: 0,
  mode: 'normal',
  style: '',
  text,
  type: 'text',
  version: 1,
});

const createDefaultParagraphNode = (): ParagraphNode => ({
  children: [createDefaultTextNode('')],
  direction: 'ltr',
  format: '',
  indent: 0,
  type: 'paragraph',
  version: 1,
});

const initialValue: SerializedEditorState = {
  root: {
    children: [createDefaultParagraphNode()],
    direction: 'ltr',
    format: '',
    indent: 0,
    type: 'root',
    version: 1,
  },
};

// Type guard to check if an object is a valid TextNode
const isValidTextNode = (node: any): node is TextNode => {
  return (
    node &&
    typeof node === 'object' &&
    typeof node.detail === 'number' &&
    typeof node.format === 'number' &&
    typeof node.mode === 'string' &&
    typeof node.style === 'string' &&
    typeof node.text === 'string' &&
    node.type === 'text' &&
    node.version === 1
  );
};

// Type guard to check if an object is a valid ParagraphNode
const isValidParagraphNode = (node: any): node is ParagraphNode => {
  return (
    node &&
    typeof node === 'object' &&
    Array.isArray(node.children) &&
    node.children.every(isValidTextNode) &&
    (node.direction === 'ltr' || node.direction === 'rtl') &&
    typeof node.format === 'string' &&
    typeof node.indent === 'number' &&
    node.type === 'paragraph' &&
    node.version === 1
  );
};

// Validate and normalize the editor state
const validateAndNormalizeState = (state: any): SerializedEditorState => {
  try {
    if (!state?.root) return initialValue;
    
    const validatedRoot = {
      ...initialValue.root,
      ...state.root,
      children: Array.isArray(state.root.children) 
        ? state.root.children.map((child: any) => {
            if (isValidParagraphNode(child)) return child;
            return createDefaultParagraphNode();
          })
        : [createDefaultParagraphNode()],
    };

    return {
      root: validatedRoot,
    };
  } catch (e) {
    console.error('Error validating editor state:', e);
    return initialValue;
  }
};

export interface ChapterContentEditorProps {
  name: string
  className?: string
  initialContent?: SerializedEditorState
  disabled?: boolean
  onChange?: (content: SerializedEditorState) => void
  placeholder?: string
}

function EditorLoading({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center justify-center min-h-[300px] border rounded-3xl bg-muted/20", className)}>
      <div className="animate-spin h-8 w-8 text-muted-foreground" />
    </div>
  )
}

function ChapterContentEditorComponent({
  name,
  className,
  initialContent = initialValue,
  disabled = false,
  onChange: externalOnChange,
  placeholder = 'Start writing your content here...',
}: ChapterContentEditorProps) {
  const { control, formState: { errors } } = useFormContext()
  const error = errors[name]?.message as string | undefined
  const [isMounted, setIsMounted] = useState(false)
  const [isPasting, setIsPasting] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  if (!isMounted) {
    return <EditorLoading className={className} />
  }

  const handlePaste = (event: React.ClipboardEvent) => {
    setIsPasting(true);
    // Let the default paste handler work
    setTimeout(() => setIsPasting(false), 100);
  };

  return (
    <div className={cn("w-full", className)} onPaste={handlePaste}>
      <div className={cn(disabled && 'opacity-50')}>
        <Controller
          name={name}
          control={control}
          defaultValue={initialContent}
          render={({ field: { onChange: formOnChange, value } }) => (
            <div className="relative">
              <div className={cn(
                "min-h-[300px] w-full p-0",
                disabled && 'cursor-not-allowed bg-muted/50',
                error && 'border-destructive',
                isPasting && 'opacity-75'
              )}>
                <div className="h-full w-full">
                  <Editor
                    editorState={undefined}
                    editorSerializedState={(() => {
                      try {
                        if (!value) return initialValue;
                        // Skip validation during pasting for better performance
                        if (isPasting) return value as SerializedEditorState;
                        
                        const parsed = typeof value === 'string' ? JSON.parse(value) : value;
                        return validateAndNormalizeState(parsed) as SerializedEditorState;
                      } catch (e) {
                        console.error('Error parsing editor content:', e);
                        return initialValue;
                      }
                    })()}
                    onSerializedChange={(content: SerializedEditorState) => {
                      try {
                        // Skip validation during pasting for better performance
                        if (isPasting) {
                          formOnChange(content);
                          return;
                        }
                        
                        const validatedContent = validateAndNormalizeState(content);
                        formOnChange(validatedContent);
                        if (externalOnChange) {
                          externalOnChange(validatedContent);
                        }
                      } catch (e) {
                        console.error('Error handling editor change:', e);
                      }
                    }}
                  />
                </div>
              </div>
              {!value && !disabled && (
                <div className="absolute top-4 left-4 pointer-events-none text-muted-foreground">
                  {placeholder}
                </div>
              )}
            </div>
          )}
        />
        {error && <p className="mt-1 text-sm text-destructive px-4">{error}</p>}
      </div>
    </div>
  )
}

const ChapterContentEditor = ({ className, ...props }: ChapterContentEditorProps) => {
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  if (!isMounted) {
    return <EditorLoading className={className} />
  }

  return <ChapterContentEditorComponent className={className} {...props} />
}

// Export the component as default and export the props type
export type { ChapterContentEditorProps as ChapterContentEditorPropsType };
export default ChapterContentEditor;
