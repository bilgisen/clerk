import * as React from "react"

// --- Lib ---
import { parseShortcutKeys } from "@/lib/tiptap-utils"

// --- Hooks ---
import { useTiptapEditor } from "@/hooks/use-tiptap-editor"
import { useR2ImageUpload } from "@/hooks/use-r2-image-upload"

// --- Tiptap UI ---
const IMAGE_UPLOAD_SHORTCUT_KEY = 'Mod+Shift+I';

// --- UI Primitives ---
import type { ButtonProps } from "@/components/tiptap-ui-primitive/button"
import { Button } from "@/components/tiptap-ui-primitive/button"
import { Badge } from "@/components/tiptap-ui-primitive/badge"
import { Progress } from "@/components/ui/progress"
import { toast } from "sonner"

// --- Types ---
interface ImageUploadButtonProps extends Omit<ButtonProps, 'type'> {
  /** The Tiptap editor instance */
  editor?: any;
  /** Optional text to display alongside the icon */
  text?: string;
  /** Whether to hide the button when image insertion is not available */
  hideWhenUnavailable?: boolean;
  /** Callback when an image is successfully inserted */
  onInserted?: () => void;
  /** Whether to show the keyboard shortcut badge */
  showShortcut?: boolean;
  /** Optional children to render inside the button */
  children?: React.ReactNode;
  /** Click handler */
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  /** Shortcut keys for the button */
  shortcutKeys?: string;
}

interface ImageShortcutBadgeProps {
  shortcutKeys?: string;
}

export function ImageShortcutBadge({ 
  shortcutKeys = IMAGE_UPLOAD_SHORTCUT_KEY 
}: ImageShortcutBadgeProps) {
  return <Badge>{parseShortcutKeys(shortcutKeys)}</Badge>;
}

/**
 * Button component for uploading/inserting images in a Tiptap editor.
 *
 * For custom button implementations, use the `useImage` hook instead.
 */
export const ImageUploadButton = React.forwardRef<HTMLButtonElement, ImageUploadButtonProps>(
  ({
    editor: providedEditor,
    text,
    hideWhenUnavailable = false,
    onInserted,
    showShortcut = false,
    onClick,
    children,
    ...buttonProps
  }, ref) => {
    const editor = providedEditor || useTiptapEditor();
    const { uploadImage, isUploading, progress } = useR2ImageUpload();
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const buttonRef = React.useRef<HTMLButtonElement>(null);

    const handleButtonClick = React.useCallback(
      (event: React.MouseEvent<HTMLButtonElement>) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        fileInputRef.current?.click();
      },
      [onClick]
    );

    React.useImperativeHandle(ref, () => buttonRef.current!);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !editor) return;

      try {
        const result = await uploadImage(file);
        if (!result) return;

        // Insert the image at the current cursor position
        editor
          .chain()
          .focus()
          .insertContent({
            type: 'image',
            attrs: {
              src: result.url,
              alt: 'Uploaded image',
              title: 'Uploaded image'
            }
          })
          .run();

        onInserted?.();
      } catch (error) {
        console.error('Error uploading image:', error);
        toast.error('Failed to upload image');
      } finally {
        // Reset the file input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };

    // Hide the button if the editor can't handle images
    if (hideWhenUnavailable && !editor?.can().insertContent({ type: 'image', attrs: { src: '' } })) {
      return null;
    }

    return (
      <div className="relative">
        <Button
          type="button"
          data-style="ghost"
          data-active-state="off"
          role="button"
          tabIndex={-1}
          disabled={!editor?.isEditable || isUploading}
          onClick={handleButtonClick}
          ref={buttonRef}
          {...buttonProps}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="tiptap-button__icon"
          >
            <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
            <circle cx="9" cy="9" r="2" />
            <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
          </svg>
          {text && <span className="tiptap-button__text">{text}</span>}
          {showShortcut && (
            <ImageShortcutBadge shortcutKeys={buttonProps.shortcutKeys || IMAGE_UPLOAD_SHORTCUT_KEY} />
          )}
          {children}
        </Button>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/*"
          style={{ display: 'none' }}
        />
        {isUploading && (
          <div className="absolute bottom-0 left-0 w-full">
            <Progress value={progress} className="h-1" />
          </div>
        )}
      </div>
    );
  }
);

ImageUploadButton.displayName = "ImageUploadButton";
