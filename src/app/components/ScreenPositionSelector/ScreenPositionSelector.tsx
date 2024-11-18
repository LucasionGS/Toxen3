import { InputLabel, Radio } from '@mantine/core';
import React, { useState } from 'react';
// import { Toxen } from 'src/app/ToxenApp';
import "./ScreenPositionSelector.scss";

interface ScreenPositionSelectorProps {
  value?: ScreenPosition;
  defaultValue?: ScreenPosition;
  onChange: (value: ScreenPosition) => void;
  label?: string;
  name?: string;
  deselectable?: boolean;
  showText?: boolean;
}

type ScreenPosition = "" | "top-left" | "top" | "top-right" | "left" | "center" | "right" | "bottom-left" | "bottom" | "bottom-right";

export default function ScreenPositionSelector(props: ScreenPositionSelectorProps) {
  const {
    value: _value,
    defaultValue,
    onChange: _onChange,
    label,
    name,
    deselectable = false,
    showText = false
  } = props;
  const [value, setValue] = useState(defaultValue || "");

  const actualValue = _value === undefined ? value : _value;
  
  const onChange = (newValue: ScreenPosition) => {
    if (deselectable && newValue === actualValue) {
      setValue("");
      _onChange("");
      return;
    }
    setValue(newValue);
    _onChange(newValue);
  }

  return (
    <div>
      {label && <InputLabel>{label}</InputLabel>}
      <Radio.Group
        name={name}
        defaultValue={defaultValue}
        value={actualValue}
        onChange={v => {
          setValue(v);
          onChange(v as ScreenPosition);
        }}
      >
        <span className="screen-position-selector">
          <span style={{ display: "flex", gap: 8 }}>
            <div
              className={"screen-position-selector-item " + (actualValue === "top-left" ? "screen-position-selector-item--selected": "")}
              onClick={() => onChange("top-left")}>
                {showText && "Top-Left"}
            </div>
            <div
              className={"screen-position-selector-item " + (actualValue === "top" ? "screen-position-selector-item--selected": "")}
              onClick={() => onChange("top")}>
                {showText && "Top"}
            </div>
            <div
              className={"screen-position-selector-item " + (actualValue === "top-right" ? "screen-position-selector-item--selected": "")}
              onClick={() => onChange("top-right")}>
                {showText && "Top-Right"}
            </div>
          </span>

          <span style={{ display: "flex", gap: 8 }}>
            <div
              className={"screen-position-selector-item " + (actualValue === "left" ? "screen-position-selector-item--selected": "")}
              onClick={() => onChange("left")}>
                {showText && "Left"}
            </div>
            <div
              className={"screen-position-selector-item " + (actualValue === "center" ? "screen-position-selector-item--selected": "")}
              onClick={() => onChange("center")}>
                {showText && "Center"}
            </div>
            <div
              className={"screen-position-selector-item " + (actualValue === "right" ? "screen-position-selector-item--selected": "")}
              onClick={() => onChange("right")}>
                {showText && "Right"}
            </div>
          </span>

          <span style={{ display: "flex", gap: 8 }}>
            <div
              className={"screen-position-selector-item " + (actualValue === "bottom-left" ? "screen-position-selector-item--selected": "")}
              onClick={() => onChange("bottom-left")}>
                {showText && "Bottom-Left"}
            </div>
            <div
              className={"screen-position-selector-item " + (actualValue === "bottom" ? "screen-position-selector-item--selected": "")}
              onClick={() => onChange("bottom")}>
                {showText && "Bottom"}
            </div>
            <div
              className={"screen-position-selector-item " + (actualValue === "bottom-right" ? "screen-position-selector-item--selected": "")}
              onClick={() => onChange("bottom-right")}>
                {showText && "Bottom-Right"}
            </div>
          </span>
        </span>
      </Radio.Group>
    </div>
  );
}