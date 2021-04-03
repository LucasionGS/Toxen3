import React, { useState } from 'react';


interface Props {
  name: string;
  defaultValue?: string;
  children?: React.ReactNode;
}

export default function SettingsInputSelect(props: Props) {
  const [value, setValue] = useState(props.defaultValue ?? null);

  return (
    <select name={props.name} className="tx-form-field" value={value} onChange={e => setValue(e.target.value)}>
      {props.children}
    </select>
  );
}
