import { useEffect, useRef } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView, lineNumbers } from '@codemirror/view';
import { syntaxHighlighting } from '@codemirror/language';
import { sql, PostgreSQL } from '@codemirror/lang-sql';
import { MergeView, unifiedMergeView } from '@codemirror/merge';
import { carmenEditorTheme, carmenHighlightStyle } from '../../lib/codemirrorTheme';
import { useMediaQuery } from '../../hooks/useMediaQuery';

interface SqlDiffViewProps {
  /** What the BU has now (left). */
  original: string;
  /** What would be applied (right). */
  current: string;
  height?: string;
}

const readOnlyExtensions = () => [
  lineNumbers(),
  sql({ dialect: PostgreSQL }),
  syntaxHighlighting(carmenHighlightStyle, { fallback: true }),
  EditorView.lineWrapping,
  EditorState.readOnly.of(true),
  EditorView.editable.of(false),
  carmenEditorTheme('12px'),
];

const COLLAPSE = { margin: 3, minSize: 4 };

/** Read-only SQL diff — side by side from `md`, unified on narrow screens (same shape as XmlDiffView). */
export function SqlDiffView({ original, current, height = '60vh' }: SqlDiffViewProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const wide = useMediaQuery('(min-width: 768px)');

  useEffect(() => {
    const parent = hostRef.current;
    if (!parent) return;
    if (wide) {
      const view = new MergeView({
        a: { doc: original, extensions: readOnlyExtensions() },
        b: { doc: current, extensions: readOnlyExtensions() },
        parent,
        collapseUnchanged: COLLAPSE,
        highlightChanges: true,
        gutter: true,
      });
      return () => view.destroy();
    }
    const view = new EditorView({
      parent,
      state: EditorState.create({
        doc: current,
        extensions: [
          ...readOnlyExtensions(),
          unifiedMergeView({ original, mergeControls: false, collapseUnchanged: COLLAPSE }),
        ],
      }),
    });
    return () => view.destroy();
  }, [original, current, wide]);

  return <div ref={hostRef} className="overflow-auto rounded-md border" style={{ maxHeight: height }} />;
}
