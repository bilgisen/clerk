import { TextMatchTransformer } from "@lexical/markdown"
import { $createTextNode } from "lexical"

interface Emoji {
  emoji: string;
  aliases: string[];
  description?: string;
  category?: string;
  tags?: string[];
  unicode_version?: string;
  ios_version?: string;
}

// Type assertion for the emoji list
const emojiList = require("@/components/editor/utils/emoji-list").default as Emoji[];

export const EMOJI: TextMatchTransformer = {
  dependencies: [],
  export: () => null,
  importRegExp: /:([a-z0-9_]+):/,
  regExp: /:([a-z0-9_]+):/,
  replace: (textNode, [, name]) => {
    if (typeof name !== 'string') return;
    const emoji = emojiList.find(e => e.aliases.includes(name))?.emoji;
    if (emoji) {
      textNode.replace($createTextNode(emoji));
    }
  },
  trigger: ":",
  type: "text-match",
}
