import React, { useState } from 'react';

interface Props {
  name: string;
  defaultValue?: string;
  children?: React.ReactNode;
  onChange?: (value: string) => void;
  nullable?: boolean;
  mouseRelease?: (value: string) => void;
}

export default function FormInputColorPicker(props: Props) {
  const [value, setValue] = useState(props.defaultValue ?? "#000000");
  let colorPicker: HTMLInputElement;
  return (
    <div style={{ position: "relative" }}>
      <input defaultValue={value}
        style={{
          pointerEvents: "none",
          opacity: 0,
          position: "absolute",
          top: 0,
          left: 0
        }} ref={ref => colorPicker = ref} type="color" onChange={e => {
          setValue(e.currentTarget.value);
          if (typeof props.onChange === "function") props.onChange(e.currentTarget.value);
        }}
        onMouseUp={(e) => props.mouseRelease(e.currentTarget.value)} />
      <input className="tx-form-field" style={{
        backgroundColor: value,
        color: rgbToGrayscale(hexToRgb(value)).r < 128 ? "#fff" : "#000",
      }} readOnly type="text" name={props.name} value={value} onClick={() => {
        colorPicker.click();
      }}
        placeholder="Click to select color"
      />
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

export function hexToRgb(hex: string): { r: number, g: number, b: number, a?: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})?$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
    a: result[4] ? parseInt(result[4], 16) : 255
  } : null;
}

export function hexToRgbArray(hex: string): [number, number, number, number?] {
  const rgb = hexToRgb(hex);
  return [rgb.r, rgb.g, rgb.b, rgb.a];
}

export function invertRgb(rgb: { r: number, g: number, b: number }) {
  const { r, g, b } = rgb ?? { r: 0, g: 0, b: 0 };
  return {
    r: 255 - r,
    g: 255 - g,
    b: 255 - b
  };
}

export function rgbToGrayscale(rgb: { r: number, g: number, b: number }) {
  const { r, g, b } = rgb ?? { r: 0, g: 0, b: 0 };
  const avg = (r + g + b) / 3;
  return {
    r: avg,
    g: avg,
    b: avg
  };
}

export function rgbArrayToHex(rgb: [number, number, number, number?]) {
  return rgbToHex({ r: rgb[0], g: rgb[1], b: rgb[2], a: rgb[3] ?? 255 });
}

export function rgbToHex(rgb: { r: number, g: number, b: number, a?: number }) {
  const { r, g, b, a } = rgb ?? { r: 0, g: 0, b: 0, a: 255 };
  // return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  return "#" + Math.round((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1) + (a ? Math.round(a).toString(16) : "");
}