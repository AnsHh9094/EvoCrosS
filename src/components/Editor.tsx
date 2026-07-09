/**
 * CodeMirror 6 Editor Component for ChromaRAVE
 * Custom syntax highlighting for ChromaScript
 */
import { useRef, useEffect, useCallback } from 'react';
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { HighlightStyle, syntaxHighlighting, StreamLanguage } from '@codemirror/language';
import { tags } from '@lezer/highlight';

// Custom ChromaScript language definition
const chromaScriptLanguage = StreamLanguage.define({
  token(stream) {
    // Comments
    if (stream.match('//')) {
      stream.skipToEnd();
      return 'comment';
    }

    // Whitespace
    if (stream.eatSpace()) return null;

    // Arrow operator
    if (stream.match('->')) return 'operator';

    // Strings
    if (stream.match(/"[^"]*"/)) return 'string';
    if (stream.match(/'[^']*'/)) return 'string';

    // Numbers
    if (stream.match(/^-?\d+(\.\d+)?/)) return 'number';

    // Keywords (visual commands)
    if (stream.match(/^(draw|shape|color|col|size|scale|pos|move|rotate|spin|pulse|osc|glow|bloom|mirror|copies|repeat|points|fill|stroke|text|trail|blend|pixel|bg|background)\b/)) {
      return 'keyword';
    }

    // Audio keywords
    if (stream.match(/^(synth|sound|drum|beat|melody|notes|bpm|tempo|volume|vol|wave|freq|filter|attack|release|loop)\b/)) {
      return 'typeName';
    }

    // Visual effect names
    if (stream.match(/^(nebula|waveform|particles|mandala|tunnel|fractal|aurora|glitch)\b/)) {
      return 'className';
    }

    // Color names
    if (stream.match(/^(red|green|blue|cyan|magenta|yellow|orange|purple|pink|white|black|gold|neon|fire|ice|acid|sunset|ocean|forest|lava)\b/)) {
      return 'atom';
    }

    // Shape names
    if (stream.match(/^(circle|rect|square|triangle|star|heart|diamond|spiral|ring|cross|polygon|poly|line)\b/)) {
      return 'variableName';
    }

    // Note names
    if (stream.match(/^[A-G][#b]?\d/)) {
      return 'labelName';
    }

    // Brackets
    if (stream.match(/^[[\](),]/)) return 'bracket';

    // Any other word
    if (stream.match(/^[a-zA-Z_]\w*/)) return 'variableName';

    // Skip unknown character
    stream.next();
    return null;
  },
});

// Theme colors matching our UI
const chromaTheme = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: '14px',
    backgroundColor: '#0c0c14',
  },
  '.cm-content': {
    fontFamily: "'JetBrains Mono', monospace",
    padding: '16px 8px',
    caretColor: '#00ffcc',
    lineHeight: '1.7',
  },
  '.cm-cursor': {
    borderLeftColor: '#00ffcc',
    borderLeftWidth: '2px',
  },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
    backgroundColor: 'rgba(0, 255, 204, 0.12) !important',
  },
  '.cm-gutters': {
    backgroundColor: '#0a0a10',
    color: '#3a3a5a',
    border: 'none',
    borderRight: '1px solid #1a1a30',
    minWidth: '45px',
  },
  '.cm-activeLineGutter': {
    backgroundColor: '#12121e',
    color: '#00ffcc',
  },
  '.cm-activeLine': {
    backgroundColor: 'rgba(0, 255, 204, 0.03)',
  },
  '.cm-matchingBracket': {
    backgroundColor: 'rgba(0, 255, 204, 0.15)',
    outline: '1px solid rgba(0, 255, 204, 0.3)',
  },
  '.cm-line': {
    padding: '0 8px',
  },
}, { dark: true });

// Syntax highlighting
const chromaHighlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: '#ff79c6', fontWeight: '600' },
  { tag: tags.typeName, color: '#8be9fd', fontWeight: '600' },
  { tag: tags.className, color: '#bd93f9', fontWeight: '600' },
  { tag: tags.string, color: '#f1fa8c' },
  { tag: tags.number, color: '#ff9d4f' },
  { tag: tags.atom, color: '#50fa7b' },
  { tag: tags.variableName, color: '#e0e0ec' },
  { tag: tags.labelName, color: '#ffb86c' },
  { tag: tags.comment, color: '#4a4a6a', fontStyle: 'italic' },
  { tag: tags.operator, color: '#00ffcc', fontWeight: '700' },
  { tag: tags.bracket, color: '#6a6a8a' },
]);

interface EditorProps {
  initialCode: string;
  onRun: (code: string) => void;
  onCodeChange?: (code: string) => void;
}

export function ChromaEditor({ initialCode, onRun, onCodeChange }: EditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const codeRef = useRef(initialCode);

  const handleRun = useCallback(() => {
    if (viewRef.current) {
      onRun(viewRef.current.state.doc.toString());
    }
  }, [onRun]);

  useEffect(() => {
    if (!containerRef.current) return;

    const runKeymap = keymap.of([{
      key: 'Shift-Enter',
      run: () => {
        handleRun();
        return true;
      },
    }]);

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        const code = update.state.doc.toString();
        codeRef.current = code;
        onCodeChange?.(code);
      }
    });

    const state = EditorState.create({
      doc: initialCode,
      extensions: [
        runKeymap,
        keymap.of([...defaultKeymap, ...historyKeymap]),
        history(),
        lineNumbers(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        chromaScriptLanguage,
        syntaxHighlighting(chromaHighlightStyle),
        chromaTheme,
        updateListener,
        EditorView.lineWrapping,
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, []);  // Only run once on mount

  // Update editor content when initialCode changes externally (e.g. preset click)
  useEffect(() => {
    if (viewRef.current && initialCode !== codeRef.current) {
      const view = viewRef.current;
      view.dispatch({
        changes: {
          from: 0,
          to: view.state.doc.length,
          insert: initialCode,
        },
      });
      codeRef.current = initialCode;
    }
  }, [initialCode]);

  return <div ref={containerRef} className="cm-editor-container" />;
}
