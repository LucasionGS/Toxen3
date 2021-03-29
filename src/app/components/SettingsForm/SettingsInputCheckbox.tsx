import React, { useState } from 'react';


interface Props {
  name: string;
  defaultChecked?: boolean;
  children?: React.ReactNode;
}

export default function SettingsInputCheckbox(props: Props) {
  const [value, setValue] = useState(props.defaultChecked ?? false);

  return (
    <div onClick={() => {
      console.log(value);

      setValue(!value);
    }}>
      <input type="hidden" name={props.name} value={value ? "1" : "0"} />
      <span hidden={!value}><i className="far fa-check-square"></i></span>
      <span hidden={value}><i className="far fa-square"></i></span>
      &nbsp;
      {props.children}
    </div>
  );
}
