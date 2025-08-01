import { Toxen } from "../../ToxenApp";
import React, { useState } from "react";
import { Button, Group, TextInput } from "@mantine/core";
import { IconSearch } from "@tabler/icons-react";

const SearchField = () => {
  const [value, setValue] = useState(Toxen.songSearch ?? "");
  const handleChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const newValue = e.target.value;
    setValue(Toxen.songSearch = newValue);

    if (newValue === "") Toxen.songPanel.update();
  };
  return (
    <Group justify="left" wrap="nowrap" align="center">
      <Button
        onClick={(e: any) => {
          e.preventDefault();
          e.stopPropagation();
          Toxen.songPanel.update();
        }}
        variant="outline"
        style={{
          marginBottom: 16
        }}
      >
        <IconSearch />
      </Button>
      <TextInput
        // leftSection={<IconSearch />}
        placeholder="Search..."
        spellCheck={false}
        type="search"
        value={value}
        onChange={handleChange}
        onKeyDown={(e) => {
          const key = e.key?.toLowerCase();
          if (key === "enter" || key === "return") {
            e.preventDefault();
            e.stopPropagation();
            Toxen.songPanel.update();
          }
        }}
        style={{
          width: "100%",
        }}
      />
    </Group>
  );
};

export default SearchField;