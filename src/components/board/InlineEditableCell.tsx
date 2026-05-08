import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';

interface InlineEditableCellProps {
  value: string;
  onSave: (value: string) => Promise<void> | void;
  placeholder: string;
  disabled?: boolean;
  multiline?: boolean;
  maxDisplayLines?: number;
}

export function InlineEditableCell({
  value,
  onSave,
  placeholder,
  disabled = false,
  multiline = false,
  maxDisplayLines,
}: InlineEditableCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const isCommittingRef = useRef(false);
  const skipBlurCommitRef = useRef(false);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    if (!editing) return;
    inputRef.current?.focus();
    if (multiline && inputRef.current instanceof HTMLTextAreaElement) {
      const el = inputRef.current;
      el.selectionStart = el.value.length;
      el.selectionEnd = el.value.length;
    }
  }, [editing, multiline]);

  useLayoutEffect(() => {
    if (!editing || !multiline || !(inputRef.current instanceof HTMLTextAreaElement)) return;

    const el = inputRef.current;
    const styles = window.getComputedStyle(el);
    const lineHeight = Number.parseFloat(styles.lineHeight) || 20;
    const paddingTop = Number.parseFloat(styles.paddingTop) || 0;
    const paddingBottom = Number.parseFloat(styles.paddingBottom) || 0;
    const borderTop = Number.parseFloat(styles.borderTopWidth) || 0;
    const borderBottom = Number.parseFloat(styles.borderBottomWidth) || 0;
    const chromeHeight = paddingTop + paddingBottom + borderTop + borderBottom;
    const minHeight = lineHeight + chromeHeight;
    const maxHeight = lineHeight * 4 + chromeHeight;

    el.style.height = 'auto';
    el.style.maxHeight = `${maxHeight}px`;
    const nextHeight = Math.max(minHeight, Math.min(el.scrollHeight, maxHeight));
    el.style.height = `${nextHeight}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }, [draft, editing, multiline]);

  const commit = async (nextDraft = draft) => {
    if (isCommittingRef.current) return;
    isCommittingRef.current = true;
    try {
      if (nextDraft !== value) {
        await onSave(nextDraft);
      }
    } finally {
      isCommittingRef.current = false;
      setEditing(false);
    }
  };

  const cancel = () => {
    skipBlurCommitRef.current = true;
    setDraft(value);
    setEditing(false);
  };

  const displayText = value || placeholder;
  const displayClassName = value ? 'text-slate-700' : 'text-slate-400 italic';
  const shellClassName = 'block w-full rounded border border-transparent px-2 py-1 text-left text-xs leading-5 align-top';

  if (editing) {
    if (multiline) {
      return (
        <textarea
          ref={inputRef as RefObject<HTMLTextAreaElement>}
          value={draft}
          rows={1}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            if (skipBlurCommitRef.current) {
              skipBlurCommitRef.current = false;
              return;
            }
            void commit();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              cancel();
            }
          }}
          className="block w-full min-w-0 rounded border border-blue-300 px-2 py-1 text-left text-xs leading-5 text-slate-700 shadow-sm outline-none ring-1 ring-blue-500 whitespace-pre-wrap resize-none"
        />
      );
    }

    return (
      <input
        ref={inputRef as RefObject<HTMLInputElement>}
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (skipBlurCommitRef.current) {
            skipBlurCommitRef.current = false;
            return;
          }
          void commit();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            void commit();
          }
          if (e.key === 'Escape') {
            e.preventDefault();
            cancel();
          }
        }}
        className="block w-full min-w-0 rounded border border-blue-300 px-2 py-1 text-left text-xs leading-5 text-slate-700 shadow-sm outline-none ring-1 ring-blue-500"
      />
    );
  }

  const display = multiline ? (
    <span
      className={`block whitespace-normal break-words text-left text-xs leading-5 ${displayClassName}`}
      style={maxDisplayLines
        ? {
            display: '-webkit-box',
            WebkitBoxOrient: 'vertical',
            WebkitLineClamp: maxDisplayLines,
            overflow: 'hidden',
          }
        : undefined}
    >
      {displayText}
    </span>
  ) : (
    <span className={`block truncate text-left text-xs ${displayClassName}`}>{displayText}</span>
  );

  if (disabled) {
    return <div className={shellClassName}>{display}</div>;
  }

  return (
    <button
      type="button"
      title={value || undefined}
      onClick={(e) => {
        e.stopPropagation();
        setDraft(value);
        setEditing(true);
      }}
      className={shellClassName}
    >
      {display}
    </button>
  );
}
