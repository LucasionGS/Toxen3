import { Toxen } from "../../ToxenApp";
import React, { useState } from "react";
import { TextInput } from "@mantine/core";

const SearchField = () => {
  const [value, setValue] = useState(Toxen.songSearch ?? "");
  const handleChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    setValue(Toxen.songSearch = e.target.value);
    Toxen.songPanel.update();
  };
  return (
    <TextInput placeholder="Search..." spellCheck={false} type="search" value={value} onChange={handleChange} style={{
      width: "85%",
    }} />
  );
};

export default SearchField;