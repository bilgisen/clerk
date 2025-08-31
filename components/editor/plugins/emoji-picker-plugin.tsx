"use client"

/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import * as React from "react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
import { MenuOption, useBasicTypeaheadTriggerMatch } from "@lexical/react/LexicalTypeaheadMenuPlugin"
import { $createTextNode, $getSelection, $isRangeSelection, type TextNode } from "lexical"
import { Command, CommandGroup, CommandItem, CommandList } from "@/components/ui/command"

declare global {
  namespace JSX {
    interface IntrinsicElements {
      command: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      'command-list': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      'command-group': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      'command-item': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    }
  }
}

// Import the dynamic component with proper typing
const DynamicTypeaheadMenu = React.lazy(
  () => import("./default/lexical-typeahead-menu-plugin")
)

class EmojiOption extends MenuOption {
  title: string
  emoji: string
  keywords: Array<string>

  constructor(
    title: string,
    emoji: string,
    options: {
      keywords?: Array<string>
    }
  ) {
    super(title)
    this.title = title
    this.emoji = emoji
    this.keywords = options.keywords || []
  }
}

// Type that matches the structure of emoji data from emoji-list.ts
type Emoji = {
  emoji: string
  description: string
  category: string
  aliases: readonly string[]
  tags: readonly string[]
  unicode_version: string
  ios_version: string
  skin_tones?: boolean
}

const MAX_EMOJI_SUGGESTION_COUNT = 10

export function EmojiPickerPlugin() {
  const [editor] = useLexicalComposerContext()
  const [queryString, setQueryString] = useState<string | null>(null)
  const [emojis, setEmojis] = useState<Emoji[]>([])
  const [isOpen, setIsOpen] = useState(false)
  
  useEffect(() => {
    import("../utils/emoji-list").then((file) => {
      // Convert the readonly array to a mutable one
      const emojiData = JSON.parse(JSON.stringify(file.default)) as Emoji[]
      setEmojis(emojiData)
    })
  }, [])

  const emojiOptions = useMemo(() => {
    return emojis.map(({ emoji, aliases, tags }) => {
      // Create new arrays to ensure mutability
      const aliasesArray = [...aliases]
      const tagsArray = [...tags]
      return new EmojiOption(aliasesArray[0], emoji, {
        keywords: [...aliasesArray, ...tagsArray]
      })
    })
  }, [emojis])

  const checkForTriggerMatch = useBasicTypeaheadTriggerMatch(":", {
    minLength: 0,
  })

  const options: EmojiOption[] = useMemo(() => {
    if (!queryString) {
      return emojiOptions.slice(0, MAX_EMOJI_SUGGESTION_COUNT)
    }
    
    const queryRegex = new RegExp(queryString, "gi")
    return emojiOptions
      .filter((option) => {
        return (
          queryRegex.test(option.title) ||
          option.keywords.some(keyword => queryRegex.test(keyword))
        )
      })
      .slice(0, MAX_EMOJI_SUGGESTION_COUNT)
  }, [emojiOptions, queryString])

  const onSelectOption = useCallback(
    (
      selectedOption: MenuOption,
      nodeToRemove: TextNode | null,
      closeMenu: () => void,
      _matchingString: string
    ) => {
      // Type guard to ensure we have an EmojiOption
      if (!(selectedOption instanceof EmojiOption)) {
        return
      }

      editor.update(() => {
        const selection = $getSelection()

        if (!$isRangeSelection(selection)) {
          return
        }

        if (nodeToRemove) {
          nodeToRemove.remove()
        }

        selection.insertNodes([$createTextNode(selectedOption.emoji)])
        closeMenu()
      })
    },
    [editor]
  )

  return (
    <React.Suspense fallback={null}>
      <DynamicTypeaheadMenu
        onQueryChange={setQueryString}
        onSelectOption={onSelectOption}
        triggerFn={checkForTriggerMatch}
        options={options}
        onOpen={() => setIsOpen(true)}
        onClose={() => setIsOpen(false)}
        menuRenderFn={(anchorElementRef, { selectedIndex, setHighlightedIndex }) => {
          if (!anchorElementRef.current || !options.length) {
            return null;
          }

          const menu = (
            <div className="fixed w-[200px] rounded-md shadow-md bg-white">
              <Command>
                <CommandList>
                  <CommandGroup>
                    {options.map((option: EmojiOption, index: number) => (
                      <CommandItem
                        key={option.key}
                        className={selectedIndex === index ? 'bg-gray-100' : ''}
                        onMouseEnter={() => setHighlightedIndex(index)}
                        onSelect={() => {
                          onSelectOption(option, null, () => {}, '');
                        }}
                      >
                        <span className="text-xl">{option.emoji}</span>
                        <span className="ml-2">{option.title}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </div>
          );

          return createPortal(menu, anchorElementRef.current);
        }}
      />
    </React.Suspense>
  );
}
