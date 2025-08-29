import * as React from "react"
import { LexicalEditor } from "lexical"
import { useWindowSize } from "@/hooks/use-window-size"

export interface CursorVisibilityOptions {
  /**
   * The Lexical editor instance
   */
  editor?: LexicalEditor | null
  /**
   * Reference to the toolbar element that may obscure the cursor
   */
  overlayHeight?: number
}

export type RectState = Omit<DOMRect, "toJSON">

/**
 * Custom hook that ensures the cursor remains visible when typing in a Lexical editor.
 * Automatically scrolls the window when the cursor would be hidden by the toolbar.
 *
 * This is particularly useful for long-form content editing where the cursor
 * might move out of the visible area as the user types.
 *
 * @param options Configuration options for cursor visibility behavior
 * @param options.editor The Lexical editor instance
 * @param options.overlayHeight Reference to the toolbar element that may obscure the cursor
 * @returns void
 */
export function useCursorVisibility({
  editor,
  overlayHeight = 0,
}: CursorVisibilityOptions) {
  const { height: windowHeight } = useWindowSize()
  const [rect, setRect] = React.useState<RectState>({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  })

  const updateRect = React.useCallback(() => {
    const element = document.body
    const DOMRect = element.getBoundingClientRect()
    setRect(DOMRect)
  }, [setRect])

  React.useEffect(() => {
    const element = document.body

    updateRect()

    const resizeObserver = new ResizeObserver(() => {
      window.requestAnimationFrame(updateRect)
    })

    resizeObserver.observe(element)
    window.addEventListener("scroll", updateRect, true)

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener("scroll", updateRect)
    }
  }, [updateRect, editor, overlayHeight])

  React.useEffect(() => {
    if (!editor) return;
    
    const ensureCursorVisibility = () => {

      // Get the root element of the editor
      const rootElement = editor.getRootElement()
      if (!rootElement) return

      // Check if editor has focus
      if (!rootElement.contains(document.activeElement)) return

      // Get the selection from the editor
      const selection = window.getSelection()
      if (!selection || selection.rangeCount === 0) return

      // Get the current selection range
      const range = selection.getRangeAt(0)
      const rect = range.getBoundingClientRect()

      // Get cursor position relative to the viewport
      const cursorTop = rect.top + window.scrollY
      const cursorBottom = rect.bottom + window.scrollY

      // Calculate the visible area considering the overlay
      const toolbarHeight = overlayHeight || 0
      const visibleTop = window.scrollY + toolbarHeight
      const visibleBottom = window.scrollY + window.innerHeight

      // If cursor is above the visible area (behind the toolbar)
      if (cursorTop < visibleTop) {
        window.scrollTo({
          top: cursorTop - toolbarHeight - 20, // 20px padding
          behavior: 'smooth',
        })
      }
      // If cursor is below the visible area
      else if (cursorBottom > visibleBottom) {
        window.scrollTo({
          top: cursorBottom - window.innerHeight + 20, // 20px padding
          behavior: 'smooth',
        })
      }
    }

    ensureCursorVisibility()
  }, [editor, overlayHeight, windowHeight, rect.height])

  return rect
}
