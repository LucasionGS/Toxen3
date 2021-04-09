import React, { useState } from 'react';

export type OptionValues = (string | [string, string])[];

interface Props {
  name: string;
  defaultValue?: string;
  children?: React.ReactNode;
  asyncValues?: Promise<OptionValues>;
  nullable?: boolean;
}

export default function FormInputSelect(props: Props) {
  const [value, setValue] = useState(props.defaultValue ?? null);
  const [options, setOptions] = useState([] as OptionValues);
  
  if (props.asyncValues instanceof Promise) props.asyncValues.then(ov => {
    // props.asyncValues = null;
    let obj: [string, string] = ["<None>", ""];
    let [firstKey, firstVal] = ov[0] ?? [];
    if (props.nullable && (
      firstKey != obj[0] || firstVal != obj[1]
    )) ov.unshift(obj);
    setOptions(ov);
  })
  
  if (props.asyncValues) return (
    <select name={props.name} className="tx-form-field" value={value} onChange={e => setValue(e.target.value)}>
      {options.map((o, i) => Array.isArray(o) ? (<option key={i} value={o[1]}>{o[0]}</option>) : (<option key={i} value={o}>{o}</option>))}
    </select>
  );
  else return (
    <select name={props.name} className="tx-form-field" value={value} onChange={e => setValue(e.target.value)}>
      {props.children}
    </select>
  );
}
