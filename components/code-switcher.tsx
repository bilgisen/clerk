"use client";

import { useAuth } from "@/hooks/use-auth";
import clsx from "clsx";
import { useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import theme from "./theme";

const TYPES = ["user"]; // Simplified since we're only using user data now

export function CodeSwitcher() {
  const [selectedType, setSelectedType] = useState(TYPES[0]);
  const { user } = useAuth();

  const selectedCode = JSON.stringify(
    {
      user,
    },
    null,
    2
  );

  const typesToShow = TYPES;

  return (
    <div className={clsx(organization ? "h-218.5" : "h-166.5")}>
      <div className="w-full bg-[#F7F7F8] rounded-md p-0.75 flex gap-1.5">
        {typesToShow.map((type) => (
          <button
            className={clsx(
              "capitalize rounded-sm h-7 text-[0.8125rem] flex-1 hover:text-black font-medium",
              selectedType === type
                ? "bg-white shadow-xs text-black"
                : "text-[#5E5F6E]"
            )}
            key={type}
            onClick={() => setSelectedType(type)}
          >
            {type}
          </button>
        ))}
      </div>
      <div className="relative h-[calc(100%-42px)]">
        <div className="mask h-full">
          {/* @ts-expect-error */}
          <SyntaxHighlighter language="javascript" style={theme}>
            {selectedCode}
          </SyntaxHighlighter>
        </div>
        <div className="absolute right-0 top-0 bottom-0 w-10 bg-linear-to-l from-white to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-[#EEEEF0]" />
      </div>
    </div>
  );
}
