import { useState } from 'react';
import { US_STATES } from '../../shared/usStates';

interface LocationPickerProps {
  label: string;
  values: string[];
  onChange(values: string[]): void;
  help?: string;
}

/** Builds location entries like "Austin, TX" or "Texas" from a city field and a state dropdown. */
export function LocationPicker({ label, values, onChange, help }: LocationPickerProps) {
  const [city, setCity] = useState('');
  const [stateAbbr, setStateAbbr] = useState('');

  const add = () => {
    const cityTrimmed = city.trim();
    const state = US_STATES.find((s) => s.abbr === stateAbbr);
    let entry = '';
    if (cityTrimmed && state) {
      entry = `${cityTrimmed}, ${state.abbr}`;
    } else if (state) {
      entry = state.name;
    } else if (cityTrimmed) {
      entry = cityTrimmed;
    }
    if (entry && !values.includes(entry)) {
      onChange([...values, entry]);
    }
    setCity('');
    setStateAbbr('');
  };

  return (
    <div className="field">
      <label className="label">{label}</label>
      <div className="field has-addons mb-0">
        <div className="control is-expanded">
          <input
            className="input"
            placeholder="City (optional)"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
          />
        </div>
        <div className="control">
          <div className="select">
            <select value={stateAbbr} onChange={(e) => setStateAbbr(e.target.value)}>
              <option value="">State…</option>
              {US_STATES.map((s) => (
                <option key={s.abbr} value={s.abbr}>
                  {s.name} ({s.abbr})
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="control">
          <button
            className="button is-link is-light"
            disabled={!city.trim() && !stateAbbr}
            onClick={add}
          >
            Add
          </button>
        </div>
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
