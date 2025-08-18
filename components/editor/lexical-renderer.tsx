"use client";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { useEffect } from "react";
import { LexicalComposer } from "@lexical/react/LexicalComposer";

export function LexicalRendererContent({ content }: { content: string }) {
  const [editor] = useLexicalComposerContext();
  
  useEffect(() => {
    if (!content) return;
    
    try {
      // Parse the editor state
      const editorState = editor.parseEditorState(content);
      editor.setEditorState(editorState);
      
      // Set read-only mode
      editor.setEditable(false);
    } catch (error) {
      console.error("Error parsing editor state:", error);
    }
  }, [content, editor]);

  return (
    <RichTextPlugin
      contentEditable={
        <ContentEditable className="prose max-w-none focus:outline-none" />
      }
      placeholder={null}
      ErrorBoundary={({ children }) => (
        <div>
          {children}
        </div>
      )}
    />
  );
}

export function LexicalRenderer({ content }: { content: string }) {
  if (!content) return null;

  return (
    <div className="prose max-w-none">
      <LexicalComposer
        initialConfig={{
          namespace: "LexicalRenderer",
          editable: false,
          editorState: content,
          onError: (error) => {
            console.error(error);
          },
          nodes: []
        }}
      >
        <LexicalRendererContent content={content} />
        <HistoryPlugin />
      </LexicalComposer>
    </div>
  );
}
