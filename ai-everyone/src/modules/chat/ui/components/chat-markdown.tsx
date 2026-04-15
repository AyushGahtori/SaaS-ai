"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface ChatMarkdownProps {
  content: string;
}

export function ChatMarkdown({ content }: ChatMarkdownProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        pre: ({ children, ...props }) => (
          <pre
            {...props}
            className="custom-scrollbar max-w-full overflow-x-auto rounded-lg bg-black/25 p-3"
          >
            {children}
          </pre>
        ),
        code: ({ className, children, ...props }) => {
          const isBlock = Boolean(className && className.includes("language-"));
          if (isBlock) {
            return (
              <code {...props} className={className}>
                {children}
              </code>
            );
          }
          return (
            <code {...props} className="rounded bg-white/10 px-1.5 py-0.5 text-[0.9em]">
              {children}
            </code>
          );
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
