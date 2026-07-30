import { KeyboardEvent, useState } from 'react';

interface TagInputProps {
  label: string;
  values: string[];
  onChange(values: string[]): void;
  placeholder?: string;
  help?: string;
}

/** Comma/Enter-delimited tag editor rendered with Bulma tags. */
export function TagInput({ label, values, onChange, placeholder, help }: TagInputProps) {
  const [draft, setDraft] = useState('');

  const commit = () => {
    const parts = draft
      .split(',')
      .map((p) => p.trim())
      .filter((p) => p && !values.includes(p));
    if (parts.length > 0) onChange([...values, ...parts]);
    setDraft('');
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      commit();
    } else if (event.key === 'Backspace' && draft === '' && values.length > 0) {
      onChange(values.slice(0, -1));
    }
  };

  return (
    <div className="field">
      <label className="label">{label}</label>
      <div className="control">
        <input
          className="input"
          value={draft}
          placeholder={placeholder ?? 'Type and press Enter'}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={commit}
        />
      </div>
      {values.length > 0 && (
        <div className="tags mt-2">
          {values.map((value) => (
            <span key={value} className="tag ck-chip">
              {value}
              <button
                className="delete is-small"
                onClick={() => onChange(values.filter((v) => v !== value))}
              />
            </span>
          ))}
        </div>
      )}
      {help && <p className="help">{help}</p>}
    </div>
  );
}
