import { useState } from 'react';
import { Pencil, X, Check } from 'lucide-react';
import { formatNumber } from '../../lib/formatters';

interface EditableFieldProps {
  label: string;
  currentValue?: number;
  computedValue: number;
  onSave: (value: number) => void;
  onClear: () => void;
}

export function EditableField({ label, currentValue, computedValue, onSave, onClear }: EditableFieldProps) {
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const hasOverride = currentValue != null;

  const startEditing = () => {
    setInputValue(String(hasOverride ? currentValue : Math.round(computedValue)));
    setEditing(true);
  };

  const save = () => {
    const num = Number(inputValue);
    if (!isNaN(num) && num >= 0) {
      onSave(num);
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1.5 mt-1">
        <input
          type="number"
          className="w-24 px-2 py-1 text-sm border border-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 tabular-nums"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
          autoFocus
        />
        <button onClick={save} className="p-1 hover:bg-emerald-50 rounded">
          <Check size={14} className="text-emerald-600" />
        </button>
        <button onClick={() => setEditing(false)} className="p-1 hover:bg-slate-100 rounded">
          <X size={14} className="text-slate-400" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 mt-1">
      <button
        onClick={startEditing}
        className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-0.5"
      >
        <Pencil size={10} />
        {hasOverride ? `Override: ${formatNumber(currentValue)}` : label}
      </button>
      {hasOverride && (
        <button onClick={onClear} className="text-xs text-slate-400 hover:text-red-500">
          (reset)
        </button>
      )}
    </div>
  );
}
