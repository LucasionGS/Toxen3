import React, { useState } from "react";
import { TextInput } from "@mantine/core";
import "./ListInput.scss";

interface ListInputProps {
  defaultValue?: string[];
  /**
   * Triggers on change of the list.
   * @param value The new list.
   * @param newValue The new value added if any. If the value is `null`, it means a value was removed.
   */
  onChange: (value: string[], newValue?: string) => void;
  label: string;
  name: string;
}

export default function ListInput(props: ListInputProps) {
  const [currentValue, setCurrentValue] = useState("");
  const [list, setList] = useState<string[]>(props.defaultValue ?? []);

  function remove(value: string) {
    const newList = list.filter(item => item !== value);
    props.onChange(newList, value);
    setList(newList);
  }

  return (
    <>
      <TextInput
        name={props.name}
        label={props.label}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (!currentValue) {
              return;
            }
            const newArray = [...list, currentValue];
            props.onChange(newArray, e.currentTarget.value || null);
            setList(newArray);
            setCurrentValue("");
          }
        }}
        value={currentValue}
        onChange={(e) => setCurrentValue(e.currentTarget.value)}
      />
      <div className="form-input-list-items">
        {list.map(v => (
          <div key={v} className="form-input-list-item" onClick={() => remove(v)} >
            {v.replace(/_/g, " ")}
            <div className="form-input-list-item-remove">✖</div>
          </div>
        ))}
      </div>
    </>
  );
}