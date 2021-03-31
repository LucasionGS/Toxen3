import React, { useState } from 'react';


interface Props {
  name: string;
  defaultValue?: string;
  children?: JSX.IntrinsicClassAttributes<"option">;
}

export default function SettingsInputSelect(props: Props) {
  const [value, setValue] = useState(props.defaultValue ?? null);

  return (
    <select value={value} onChange={e => setValue(e.target.value)}>
      {props.children}
    </select>
  );
}
