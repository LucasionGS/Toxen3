import { Toxen } from "../../ToxenApp";
import React, { useState } from "react";

const SearchField = () => {
  const [value, setValue] = useState(Toxen.songSearch ?? "");
  const handleChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    setValue(Toxen.songSearch = e.target.value);
    Toxen.songPanel.update();
  };
  return (
    <div>
      <input spellCheck={false} type="search" className="tx-form-field tx-form-field-search" value={value} onChange={handleChange} />
    </div>
  );
};

export default SearchField;