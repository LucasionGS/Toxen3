import React, { useState } from 'react';
import Select from 'react-select'

interface Props {
  name: string;
  defaultValue?: string;
  children?: React.ReactNode;
  async?: boolean;
}

export default function SettingsInputSelect(props: Props) {
  const [value, setValue] = useState(props.defaultValue ?? null);

  if (props.async) return (
    <select name={props.name} className="tx-form-field" value={value} onChange={e => setValue(e.target.value)}>
      {props.children}
    </select>
  );
  else return (
    <select name={props.name} className="tx-form-field" value={value} onChange={e => setValue(e.target.value)}>
      {props.children}
    </select>
  );
}
