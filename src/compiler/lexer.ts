export const TokenType = {
  IDENTIFIER: 'IDENTIFIER',
  LPAREN: 'LPAREN',
  RPAREN: 'RPAREN',
  STRING: 'STRING',
  NUMBER: 'NUMBER',
  ARROW: 'ARROW',
  COMMA: 'COMMA',
  DOT: 'DOT',
  COLON: 'COLON',
  LBRACKET: 'LBRACKET',
  RBRACKET: 'RBRACKET',
  NEWLINE: 'NEWLINE',
  EOF: 'EOF',
} as const;

export type TokenType = (typeof TokenType)[keyof typeof TokenType];

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  col: number;
}

export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let current = 0;
  let line = 1;
  let col = 1;

  while (current < input.length) {
    const char = input[current];

    // Track newlines
    if (char === '\n') {
      tokens.push({ type: TokenType.NEWLINE, value: '\n', line, col });
      current++;
      line++;
      col = 1;
      continue;
    }

    // Skip whitespace (not newlines)
    if (/[ \t\r]/.test(char)) {
      current++;
      col++;
      continue;
    }

    // Skip comments (// to end of line)
    if (char === '/' && input[current + 1] === '/') {
      while (current < input.length && input[current] !== '\n') {
        current++;
      }
      continue;
    }

    if (char === '(') {
      tokens.push({ type: TokenType.LPAREN, value: '(', line, col });
      current++; col++;
      continue;
    }

    if (char === ')') {
      tokens.push({ type: TokenType.RPAREN, value: ')', line, col });
      current++; col++;
      continue;
    }

    if (char === '[') {
      tokens.push({ type: TokenType.LBRACKET, value: '[', line, col });
      current++; col++;
      continue;
    }

    if (char === ']') {
      tokens.push({ type: TokenType.RBRACKET, value: ']', line, col });
      current++; col++;
      continue;
    }

    if (char === ',') {
      tokens.push({ type: TokenType.COMMA, value: ',', line, col });
      current++; col++;
      continue;
    }

    if (char === '.') {
      tokens.push({ type: TokenType.DOT, value: '.', line, col });
      current++; col++;
      continue;
    }

    if (char === ':') {
      tokens.push({ type: TokenType.COLON, value: ':', line, col });
      current++; col++;
      continue;
    }

    if (char === '-' && input[current + 1] === '>') {
      tokens.push({ type: TokenType.ARROW, value: '->', line, col });
      current += 2; col += 2;
      continue;
    }

    // Numbers (including negatives and decimals)
    if (/[0-9]/.test(char) || (char === '-' && /[0-9]/.test(input[current + 1] || ''))) {
      let value = '';
      const startCol = col;
      if (char === '-') { value += '-'; current++; col++; }
      while (current < input.length && /[0-9.]/.test(input[current])) {
        value += input[current];
        current++; col++;
      }
      tokens.push({ type: TokenType.NUMBER, value, line, col: startCol });
      continue;
    }

    // Strings
    if (char === '"' || char === "'") {
      const quote = char;
      let value = '';
      const startCol = col;
      current++; col++;
      while (current < input.length && input[current] !== quote) {
        if (input[current] === '\n') { line++; col = 0; }
        value += input[current];
        current++; col++;
      }
      current++; col++; // skip closing quote
      tokens.push({ type: TokenType.STRING, value, line, col: startCol });
      continue;
    }

    // Identifiers (letters, digits, underscores, hyphens)
    if (/[a-zA-Z_]/.test(char)) {
      let value = '';
      const startCol = col;
      while (current < input.length && /[a-zA-Z0-9_#-]/.test(input[current])) {
        value += input[current];
        current++; col++;
      }
      tokens.push({ type: TokenType.IDENTIFIER, value, line, col: startCol });
      continue;
    }

    // Special characters for operators
    if (/[+\-*/%=<>!&|^~]/.test(char)) {
      tokens.push({ type: TokenType.IDENTIFIER, value: char, line, col });
      current++; col++;
      continue;
    }

    throw new SyntaxError(`Unexpected character '${char}' at line ${line}, column ${col}`);
  }

  tokens.push({ type: TokenType.EOF, value: '', line, col });
  return tokens;
}
