"use client";

/**
 * Markdown renderer for model output.
 *
 * The system prompts ask Gemini for Markdown, so the UI must render it — users
 * were seeing literal `**` and `#` (audit C-10). This is a dependency-free
 * renderer: no `dangerouslySetInnerHTML` anywhere, every node is a React
 * element, so model output cannot inject HTML or script (audit L-17).
 *
 * Supported: ATX headings, dash or bullet lists, numbered lists, fenced code,
 * inline code, bold, italic, blockquotes, rules, and bare links.
 */

import { Fragment, type ReactNode } from "react";

type Block =
  | { kind: "code"; lang: string; text: string }
  | { kind: "heading"; level: number; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[] }
  | { kind: "quote"; text: string }
  | { kind: "rule" }
  | { kind: "p"; text: string };

function parse(markdown: string): Block[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // fenced code
    const fence = line.match(/^\s*```(\S*)\s*$/);
    if (fence) {
      const lang = fence[1] ?? "";
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) {
        body.push(lines[i]);
        i += 1;
      }
      i += 1; // closing fence
      blocks.push({ kind: "code", lang, text: body.join("\n") });
      continue;
    }

    if (/^\s*$/.test(line)) {
      i += 1;
      continue;
    }

    const heading = line.match(/^\s{0,3}(#{1,6})\s+(.*)$/);
    if (heading) {
      blocks.push({ kind: "heading", level: heading[1].length, text: heading[2].trim() });
      i += 1;
      continue;
    }

    if (/^\s{0,3}([-*_])(\s*\1){2,}\s*$/.test(line)) {
      blocks.push({ kind: "rule" });
      i += 1;
      continue;
    }

    if (/^\s*>\s?/.test(line)) {
      const body: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        body.push(lines[i].replace(/^\s*>\s?/, ""));
        i += 1;
      }
      blocks.push({ kind: "quote", text: body.join("\n") });
      continue;
    }

    if (/^\s*[-*•]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*•]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*•]\s+/, ""));
        i += 1;
      }
      blocks.push({ kind: "ul", items });
      continue;
    }

    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+[.)]\s+/, ""));
        i += 1;
      }
      blocks.push({ kind: "ol", items });
      continue;
    }

    // paragraph: consume until a blank line or the start of another block
    const para: string[] = [];
    while (
      i < lines.length &&
      !/^\s*$/.test(lines[i]) &&
      !/^\s*```/.test(lines[i]) &&
      !/^\s{0,3}#{1,6}\s/.test(lines[i]) &&
      !/^\s*[-*•]\s+/.test(lines[i]) &&
      !/^\s*\d+[.)]\s+/.test(lines[i]) &&
      !/^\s*>\s?/.test(lines[i])
    ) {
      para.push(lines[i]);
      i += 1;
    }
    if (para.length) blocks.push({ kind: "p", text: para.join("\n") });
    else i += 1; // safety: never spin
  }

  return blocks;
}

/** Inline spans: code, bold, italic, and plain URLs. All text, no HTML. */
function inline(text: string, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  // code first so ** inside `code` is not re-parsed
  const pattern = /(`[^`]+`)|(\*\*[^*]+\*\*)|(__[^_]+__)|(\*[^*\n]+\*)|(_[^_\n]+_)|(https?:\/\/[^\s)]+)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let n = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) out.push(text.slice(last, match.index));
    const token = match[0];
    const key = `${keyPrefix}-${n++}`;
    if (token.startsWith("`")) {
      out.push(<code key={key} className="md-code">{token.slice(1, -1)}</code>);
    } else if (token.startsWith("**") || token.startsWith("__")) {
      out.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    } else if (/^https?:\/\//.test(token)) {
      out.push(
        <a key={key} href={token} target="_blank" rel="noreferrer noopener">{token}</a>,
      );
    } else {
      out.push(<em key={key}>{token.slice(1, -1)}</em>);
    }
    last = match.index + token.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export default function Markdown({ text, className = "md" }: { text: string; className?: string }) {
  if (!text) return null;
  const blocks = parse(text);
  const nodes: ReactNode[] = blocks.map((block, index) => {
    const key = `b-${index}`;
    switch (block.kind) {
      case "code":
        return (
          <pre key={key} className="md-pre">
            <code>{block.text}</code>
          </pre>
        );
      case "heading": {
        const Tag = (`h${Math.min(block.level + 2, 6)}`) as "h3" | "h4" | "h5" | "h6";
        return <Tag key={key} className="md-h">{inline(block.text, key)}</Tag>;
      }
      case "ul":
        return (
          <ul key={key} className="md-ul">
            {block.items.map((item, i) => <li key={`${key}-${i}`}>{inline(item, `${key}-${i}`)}</li>)}
          </ul>
        );
      case "ol":
        return (
          <ol key={key} className="md-ol">
            {block.items.map((item, i) => <li key={`${key}-${i}`}>{inline(item, `${key}-${i}`)}</li>)}
          </ol>
        );
      case "quote":
        return <blockquote key={key} className="md-quote">{inline(block.text, key)}</blockquote>;
      case "rule":
        return <hr key={key} className="md-rule" />;
      default:
        return (
          <p key={key} className="md-p">
            {block.text.split("\n").map((line, i) => (
              <Fragment key={`${key}-${i}`}>
                {i > 0 && <br />}
                {inline(line, `${key}-${i}`)}
              </Fragment>
            ))}
          </p>
        );
    }
  });

  return <div className={className}>{nodes}</div>;
}

/**
 * Linkify-only variant for stored answer bodies rendered on the server
 * (/j/[slug]). Returns React nodes, so no HTML injection is possible.
 */
export function PlainText({ text }: { text: string }) {
  return <>{text.split("\n").map((line, i) => (
    <Fragment key={`l-${i}`}>
      {i > 0 && <br />}
      {inline(line, `l-${i}`)}
    </Fragment>
  ))}</>;
}
