import React, { useState } from 'react';
import "./FormInputCheckbox.scss";

interface Props {
  name: string;
  defaultChecked?: boolean;
  children?: React.ReactNode;
}

export default function FormInputCheckbox(props: Props) {
  const [value, setValue] = useState(props.defaultChecked ?? false);

  return (
    <div className="form-input-checkbox" onClick={() => {
      setValue(!value);
    }}>
      <input type="hidden" name={props.name} value={value ? "1" : "0"} />
      <span className="toggle-icon" hidden={!value}><i className="fas fa-check-circle"></i></span>
      <span className="toggle-icon" hidden={value}><i className="far fa-circle"></i></span>
      &nbsp;
      {props.children}
    </div>
  );
}
