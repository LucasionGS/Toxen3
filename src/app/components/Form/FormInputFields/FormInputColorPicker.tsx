import React, { useState } from 'react';

interface Props {
  name: string;
  defaultValue?: string;
  children?: React.ReactNode;
  onChange?: (value: string) => void;
  nullable?: boolean;
}

export default function FormInputColorPicker(props: Props) {
  const [value, setValue] = useState(props.defaultValue ?? "#000");
  let colorPicker: HTMLInputElement;
  return (
    <div style={{ position: "relative" }}>
      <input defaultValue={value} style={{ pointerEvents: "none", opacity: 0, position: "absolute", top: 0, left: 0 }} ref={ref => colorPicker = ref} type="color" onChange={e => {
        setValue(e.currentTarget.value);
        if (typeof props.onChange === "function") props.onChange(e.currentTarget.value);
      }} />
      <input className="tx-form-field" style={{ backgroundColor: value }} readOnly type="text" name={props.name} value={value} onClick={() => {
        colorPicker.click();
      }} />
      {
        props.nullable ? (
          <button className="tx-btn" onClick={() => {
            setValue("");
            if (typeof props.onChange === "function") props.onChange("");
          }}>
            Clear
          </button>
        ) : ""
      }
      {
        props.defaultValue !== value ? (
          <button className="tx-btn tx-btn-action" onClick={() => {
            setValue(props.defaultValue);
            if (typeof props.onChange === "function") props.onChange(props.defaultValue);
          }}>
            <i className="fas fa-redo"></i>
            &nbsp;
            Reset
            </button>
        ) : ""
      }
    </div>
  );
}
