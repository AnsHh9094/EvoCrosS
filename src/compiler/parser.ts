import { TokenType } from './lexer';
import type { Token } from './lexer';

// AST Node Types
export interface Program {
  type: 'Program';
  body: Statement[];
}

export type Statement = CommandStatement | ChainStatement;

export interface CommandStatement {
  type: 'CommandStatement';
  command: string;
  args: Expression[];
}

export interface ChainStatement {
  type: 'ChainStatement';
  steps: CommandStatement[];
}

export type Expression =
  | NumberLiteral
  | StringLiteral
  | ArrayLiteral
  | FunctionCall
  | Identifier;

export interface NumberLiteral {
  type: 'NumberLiteral';
  value: number;
}

export interface StringLiteral {
  type: 'StringLiteral';
  value: string;
}

export interface ArrayLiteral {
  type: 'ArrayLiteral';
  elements: Expression[];
}

export interface FunctionCall {
  type: 'FunctionCall';
  name: string;
  args: Expression[];
}

export interface Identifier {
  type: 'Identifier';
  name: string;
}

export function parse(tokens: Token[]): Program {
  let current = 0;

  function peek(): Token {
    return tokens[current] || { type: TokenType.EOF, value: '', line: 0, col: 0 };
  }

  function advance(): Token {
    return tokens[current++];
  }

  function skipNewlines(): void {
    while (peek().type === TokenType.NEWLINE) {
      advance();
    }
  }

  function parseExpression(): Expression {
    const token = peek();

    if (token.type === TokenType.NUMBER) {
      advance();
      return { type: 'NumberLiteral', value: Number(token.value) };
    }

    if (token.type === TokenType.STRING) {
      advance();
      return { type: 'StringLiteral', value: token.value };
    }

    if (token.type === TokenType.LBRACKET) {
      return parseArray();
    }

    if (token.type === TokenType.IDENTIFIER) {
      const next = tokens[current + 1];
      if (next && next.type === TokenType.LPAREN) {
        return parseFunctionCall();
      }
      advance();
      return { type: 'Identifier', name: token.value };
    }

    if (token.type === TokenType.LPAREN) {
      // Parenthesized expression - parse as function call
      return parseFunctionCall();
    }

    throw new SyntaxError(
      `Unexpected token '${token.value}' (${token.type}) at line ${token.line}:${token.col}`
    );
  }

  function parseArray(): ArrayLiteral {
    advance(); // skip [
    const elements: Expression[] = [];
    while (peek().type !== TokenType.RBRACKET && peek().type !== TokenType.EOF) {
      skipNewlines();
      elements.push(parseExpression());
      if (peek().type === TokenType.COMMA) advance();
      skipNewlines();
    }
    if (peek().type === TokenType.RBRACKET) advance();
    return { type: 'ArrayLiteral', elements };
  }

  function parseFunctionCall(): FunctionCall {
    const nameToken = advance(); // function name
    const args: Expression[] = [];

    if (peek().type === TokenType.LPAREN) {
      advance(); // skip (
      while (peek().type !== TokenType.RPAREN && peek().type !== TokenType.EOF) {
        skipNewlines();
        args.push(parseExpression());
        if (peek().type === TokenType.COMMA) advance();
        skipNewlines();
      }
      if (peek().type === TokenType.RPAREN) advance(); // skip )
    }

    return { type: 'FunctionCall', name: nameToken.value, args };
  }

  function parseStatement(): Statement {
    skipNewlines();
    if (peek().type === TokenType.EOF) {
      return { type: 'CommandStatement', command: 'noop', args: [] };
    }

    // Parse the first command
    const firstToken = peek();

    if (firstToken.type === TokenType.IDENTIFIER) {
      const commandName = advance().value;
      const args: Expression[] = [];

      // Collect arguments until newline or EOF or arrow
      while (
        peek().type !== TokenType.NEWLINE &&
        peek().type !== TokenType.EOF &&
        peek().type !== TokenType.ARROW
      ) {
        args.push(parseExpression());
        if (peek().type === TokenType.COMMA) advance();
      }

      const firstCmd: CommandStatement = {
        type: 'CommandStatement',
        command: commandName,
        args,
      };

      // Check for chaining with ->
      if (peek().type === TokenType.ARROW) {
        const steps: CommandStatement[] = [firstCmd];
        while (peek().type === TokenType.ARROW) {
          advance(); // skip ->
          skipNewlines();
          const nextName = advance().value;
          const nextArgs: Expression[] = [];
          while (
            peek().type !== TokenType.NEWLINE &&
            peek().type !== TokenType.EOF &&
            peek().type !== TokenType.ARROW
          ) {
            nextArgs.push(parseExpression());
            if (peek().type === TokenType.COMMA) advance();
          }
          steps.push({
            type: 'CommandStatement',
            command: nextName,
            args: nextArgs,
          });
        }
        return { type: 'ChainStatement', steps };
      }

      return firstCmd;
    }

    throw new SyntaxError(
      `Expected command name, got '${firstToken.value}' at line ${firstToken.line}:${firstToken.col}`
    );
  }

  const program: Program = { type: 'Program', body: [] };

  skipNewlines();
  while (peek().type !== TokenType.EOF) {
    const stmt = parseStatement();
    if (stmt.type === 'CommandStatement' && stmt.command === 'noop') {
      // skip noop
    } else {
      program.body.push(stmt);
    }
    skipNewlines();
  }

  return program;
}
