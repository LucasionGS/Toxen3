import React from "react";
import { Checkbox, ColorInput, Group, NumberInput, TextInput } from "@mantine/core";
import SubtitleParser from "../../toxen/SubtitleParser";

interface SubtitleOptionsFormProps {
  options: Partial<SubtitleParser.SubtitleOptions>;
  onChange: (key: keyof SubtitleParser.SubtitleOptions, value: string) => void;
  compact?: boolean;
}

export default function SubtitleOptionsForm(props: SubtitleOptionsFormProps) {
  const { options, onChange } = props;
  return (
    <div className={"subtitle-editor-options-form" + (props.compact ? " compact" : "")}>
      <ColorInput
        size="xs"
        label="Color"
        placeholder="Inherit"
        value={options.color ?? ""}
        onChange={value => onChange("color", value)}
      />
      <TextInput
        size="xs"
        label="Font"
        placeholder="Inherit"
        value={options.font ?? ""}
        onChange={e => onChange("font", e.currentTarget.value)}
      />
      <NumberInput
        size="xs"
        label="Font size (px)"
        placeholder="Inherit"
        min={1}
        value={options.fontSize ? +options.fontSize : ""}
        onChange={value => onChange("fontSize", value === "" || value === null ? "" : String(value))}
      />
      <ColorInput
        size="xs"
        label="Outline color"
        placeholder="Default"
        value={options.outlineColor ?? ""}
        onChange={value => onChange("outlineColor", value)}
      />
      <NumberInput
        size="xs"
        label="Vertical position (%)"
        placeholder="Default"
        min={0}
        max={100}
        value={options.verticalPosition ? +options.verticalPosition : ""}
        onChange={value => onChange("verticalPosition", value === "" || value === null ? "" : String(value))}
      />
      <Group gap="md" className="subtitle-editor-options-toggles">
        <Checkbox
          size="xs"
          label="Bold"
          checked={options.bold === "true"}
          onChange={e => onChange("bold", e.currentTarget.checked ? "true" : "")}
        />
        <Checkbox
          size="xs"
          label="Italic"
          checked={options.italic === "true"}
          onChange={e => onChange("italic", e.currentTarget.checked ? "true" : "")}
        />
      </Group>
    </div>
  );
}
