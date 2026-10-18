import { Fragment } from "react";

import type { ExecutedStatement } from "@/lib/api-schemas";
import { cn } from "@/lib/cn";
import { formatInteger, formatMs } from "@/lib/formatters";

const KEYWORDS = new Set([
  "MATCH",
  "OPTIONAL",
  "WHERE",
  "RETURN",
  "WITH",
  "UNWIND",
  "LIMIT",
  "ORDER",
  "BY",
  "AS",
  "AND",
  "OR",
  "NOT",
  "IN",
  "IS",
  "NULL",
  "CASE",
  "WHEN",
  "THEN",
  "ELSE",
  "END",
  "DISTINCT",
  "SKIP",
  "DESC",
  "ASC",
  "UNION",
  "ALL",
  "CALL",
  "YIELD",
  "EXISTS",
  "TRUE",
  "FALSE",
]);

type Token = {
  text: string;
  kind: "keyword" | "param" | "label" | "string" | "number" | "fn" | "plain";
};

// One pass, longest constructs first: strings, $params, :Labels, numbers, words.
const TOKEN_RE =
  /('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")|(\$[A-Za-z_][\w]*)|(:[A-Za-z_][\w]*)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_][\w]*)(?=\s*\()|([A-Za-z_][\w]*)/g;

export function tokenizeCypher(source: string): Token[] {
  const tokens: Token[] = [];
  let last = 0;
  for (const match of source.matchAll(TOKEN_RE)) {
    const index = match.index ?? 0;
    if (index > last) tokens.push({ text: source.slice(last, index), kind: "plain" });
    const [text, str, param, label, num, fn, word] = match;
    if (str) tokens.push({ text, kind: "string" });
    else if (param) tokens.push({ text, kind: "param" });
    else if (label) tokens.push({ text, kind: "label" });
    else if (num) tokens.push({ text, kind: "number" });
    else if (fn) tokens.push({ text, kind: KEYWORDS.has(fn.toUpperCase()) ? "keyword" : "fn" });
    else if (word)
      tokens.push({ text, kind: KEYWORDS.has(word.toUpperCase()) ? "keyword" : "plain" });
    last = index + text.length;
  }
  if (last < source.length) tokens.push({ text: source.slice(last), kind: "plain" });
  return tokens;
}

const TOKEN_CLASS: Record<Token["kind"], string> = {
  keyword: "text-accent",
  param: "text-warning",
  label: "text-safe",
  string: "text-[#9fd7a8]",
  number: "text-[#f5b57a]",
  fn: "text-[#8fb8f2]",
  plain: "text-fg-secondary",
};

export function CypherCode({ source, className }: { source: string; className?: string }) {
  return (
    <pre
      className={cn(
        "max-h-72 scrollbar-thin overflow-auto rounded-md border border-border bg-surface-sunken p-3 font-mono text-[11px] leading-[1.6]",
        className,
      )}
    >
      <code>
        {tokenizeCypher(source).map((token, index) => (
          <span key={index} className={TOKEN_CLASS[token.kind]}>
            {token.text}
          </span>
        ))}
      </code>
    </pre>
  );
}

function formatParameter(value: ExecutedStatement["parameters"][string]): string {
  return JSON.stringify(value);
}

export function StatementList({ statements }: { statements: ExecutedStatement[] }) {
  return (
    <ol className="space-y-3">
      {statements.map((statement, index) => (
        <li key={index}>
          <p className="mb-1 flex items-center justify-between text-[11px] text-fg-muted">
            <span>
              Statement {index + 1} of {statements.length}
            </span>
            <span>
              {formatInteger(statement.rows)} {statement.rows === 1 ? "row" : "rows"},{" "}
              {formatMs(statement.duration_ms)}
            </span>
          </p>
          <CypherCode source={statement.cypher} />
          {Object.keys(statement.parameters).length > 0 ? (
            <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 font-mono text-[11px]">
              {Object.entries(statement.parameters).map(([name, value]) => (
                <Fragment key={name}>
                  <dt className="text-warning">${name}</dt>
                  <dd className="truncate text-fg-secondary">{formatParameter(value)}</dd>
                </Fragment>
              ))}
            </dl>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

/** First line of the first statement, as a compact preview. */
export function firstLine(statements: ExecutedStatement[]): string | null {
  const first = statements[0]?.cypher.split("\n")[0];
  return first ? first.trim() : null;
}
