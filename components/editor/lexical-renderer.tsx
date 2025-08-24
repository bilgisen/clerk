"use client";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { useEffect, useMemo } from "react";

type ContentInput = string | Record<string, any> | null | undefined;

function isHtmlString(s: string) {
  const trimmed = s.trim();
  return trimmed.startsWith("<") && trimmed.endsWith(">"); // kaba ama iş görür
}

function toSerializedString(content: ContentInput): string {
  if (!content) return "";
  return typeof content === "string" ? content : JSON.stringify(content);
}

function isValidLexicalState(serialized: string) {
  try {
    const obj = JSON.parse(serialized);
    // Lexical’in tipik şekli: { root: { children: [...] } }
    return (
      obj &&
      typeof obj === "object" &&
      obj.root &&
      typeof obj.root === "object" &&
      Array.isArray(obj.root.children) // burası kritik: .map hatasını engeller
    );
  } catch {
    return false;
  }
}

export function LexicalRendererContent({ content }: { content: string }) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    if (!content) return;

    try {
      const editorState = editor.parseEditorState(content);
      editor.setEditorState(editorState);
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
      ErrorBoundary={({ children }) => <div>{children}</div>}
    />
  );
}

export function LexicalRenderer({ content }: { content: ContentInput }) {
  const serialized = useMemo(() => toSerializedString(content), [content]);

  // 1) Geçerli Lexical JSON ise: Lexical ile render
  const canUseLexical = useMemo(
    () => serialized && isValidLexicalState(serialized),
    [serialized]
  );

  // 2) HTML ise: direkt HTML render (okunur görünüm için)
  const canUseHtml = useMemo(
    () => serialized && typeof serialized === "string" && isHtmlString(serialized),
    [serialized]
  );

  if (!serialized) return null;

  if (canUseLexical) {
    return (
      <div className="prose max-w-none [&_p]:mb-4 [&_p:last-child]:mb-0 [&_p]:leading-relaxed">
        <LexicalComposer
          initialConfig={{
            namespace: "LexicalRenderer",
            editable: false,
            editorState: (editor) => {
              try {
                const editorState = editor.parseEditorState(serialized);
                editor.setEditorState(editorState);
              } catch (err) {
                console.error("Error parsing editor state:", err);
              }
            },
            onError: (error) => console.error(error),
            nodes: [],
            theme: {
              paragraph: 'mb-4 last:mb-0 leading-relaxed',
            },
          }}
        >
          <LexicalRendererContent content={serialized} />
        </LexicalComposer>
      </div>
    );
  }

  if (canUseHtml) {
    // İçerik HTML kaydedildiyse okunur şekilde göster
    return (
      <div
        className="prose max-w-none [&_p]:mb-4 [&_p:last-child]:mb-0 [&_p]:leading-relaxed"
        dangerouslySetInnerHTML={{ __html: serialized }}
      />
    );
  }

  // Ne Lexical JSON ne de HTML — gösteremiyoruz
  return (
    <div className="text-muted-foreground italic">
      İçerik formatı desteklenmiyor veya bozuk.
    </div>
  );
}
