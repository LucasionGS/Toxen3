import React, { useState } from 'react';
import { IconCircleCheck, IconCircle } from '@tabler/icons-react';
import FormInput from './FormInput';
import "./FormInputCheckbox.scss";

interface Props {
  name: string;
  defaultChecked?: boolean;
  children?: React.ReactNode;
  onChange?: (e: React.MouseEvent<HTMLDivElement, MouseEvent>, newState: boolean) => void;
}

export default function FormInputCheckbox(props: Props) {
  const [value, setValue] = useState(props.defaultChecked ?? false);

  return (
    <div className="form-input-checkbox" onClick={(e) => {
      const newState = !value;
      if (props.onChange) {
        props.onChange(e, newState);
      }
      setValue(newState);
    }}>
      <input type="hidden" name={props.name} value={FormInput.toStringValue("boolean", value)} />
      <span className="toggle-icon" hidden={!value}><IconCircleCheck size="1em" /></span>
      <span className="toggle-icon" hidden={value}><IconCircle size="1em" /></span>
      &nbsp;
      {props.children}
    </div>
  );
}
