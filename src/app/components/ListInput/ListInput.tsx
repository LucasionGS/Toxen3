import React, { useState } from "react";
import { Badge, InputLabel, TagsInput, TextInput } from "@mantine/core";
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

  return (
    <>
      <TagsInput 
        label={props.label}
        value={list} 
        onChange={(value) => {
          props.onChange(value);
          setList(value);
        }} 
        onRemove={(_) => {
          const i = list.indexOf(_);
          const value = list[i];
          const newList = [...list];
          newList.splice(i, 1);
          props.onChange(newList, value);
          setList(newList);
        }} 
      />
    </>
  );
}