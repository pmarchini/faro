// A small line-by-line highlighter for the code panel. Each code line is a
// Button, so the whole line can be clicked, and a Button holds only strings
// and Text: the Code element's highlighting cannot be used inside one. This
// colours keywords, strings, numbers and comments, line by line; a string or
// comment spanning lines is coloured on its first line only.

export type TokenKind = 'keyword' | 'string' | 'number' | 'comment' | 'plain'

export type Token = { text: string; kind: TokenKind }

const KEYWORDS = new Set([
  'abstract', 'as', 'async', 'await', 'break', 'case', 'catch', 'class', 'const', 'continue', 'def', 'default',
  'defer', 'delete', 'do', 'elif', 'else', 'enum', 'except', 'export', 'extends', 'false', 'finally', 'fn', 'for',
  'from', 'func', 'function', 'go', 'if', 'impl', 'implements', 'import', 'in', 'instanceof', 'interface', 'is',
  'lambda', 'let', 'match', 'mut', 'new', 'nil', 'None', 'not', 'null', 'of', 'or', 'and', 'package', 'pass',
  'private', 'protected', 'pub', 'public', 'raise', 'readonly', 'return', 'self', 'static', 'struct', 'super',
  'switch', 'this', 'throw', 'trait', 'True', 'False', 'true', 'try', 'type', 'typeof', 'undefined', 'use', 'var',
  'void', 'while', 'with', 'yield',
])

// Languages whose line comments start with #.
const HASH_COMMENTS = /\.(py|rb|sh|bash|zsh|ya?ml|toml|r|pl|ex|exs|nix|mk)$|(^|\/)(Makefile|Dockerfile)$/

export function tokens(line: string, path: string): Token[] {
  const comment = HASH_COMMENTS.test(path) ? '#' : '//'
  const out: Token[] = []
  let index = 0

  const push = (text: string, kind: TokenKind) => {
    const last = out.at(-1)
    if (last && last.kind === kind) last.text += text
    else out.push({ text, kind })
  }

  while (index < line.length) {
    const rest = line.slice(index)

    if (rest.startsWith(comment) || rest.startsWith('/*') || (comment === '//' && rest.trimStart().startsWith('*') && line.trimStart() === rest.trimStart())) {
      push(rest, 'comment')
      break
    }

    const quote = rest[0]

    if (quote === '"' || quote === "'" || quote === '`') {
      let end = 1
      while (end < rest.length && rest[end] !== quote) end += rest[end] === '\\' ? 2 : 1
      push(rest.slice(0, end + 1), 'string')
      index += end + 1
      continue
    }

    const word = /^[A-Za-z_$][\w$]*/.exec(rest)?.[0]

    if (word) {
      push(word, KEYWORDS.has(word) ? 'keyword' : 'plain')
      index += word.length
      continue
    }

    const number = /^\d[\d_.xXa-fA-F]*/.exec(rest)?.[0]

    if (number) {
      push(number, 'number')
      index += number.length
      continue
    }

    push(rest[0] ?? '', 'plain')
    index += 1
  }

  return out
}
