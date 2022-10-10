import { Toxen } from "../../ToxenApp";
import React, { useState } from "react";
import { TextInput } from "@mantine/core";

const SearchField = () => {
  const [value, setValue] = useState(Toxen.songSearch ?? "");
  const handleChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const newValue = e.target.value;
    setValue(Toxen.songSearch = newValue);

    if (newValue === "") Toxen.songPanel.update();
  };
  return (
    <TextInput
      placeholder="Search..."
      spellCheck={false}
      type="search"
      value={value}
      onChange={handleChange}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.stopPropagation();
          Toxen.songPanel.update();
        }
      }}
      style={{
        width: "85%",
      }}
    />
  );
};

export default SearchField;