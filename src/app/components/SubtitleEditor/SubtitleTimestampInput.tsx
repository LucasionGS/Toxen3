import React, { useEffect, useState } from "react";
import { TextInput } from "@mantine/core";
import Time from "../../toxen/Time";

interface SubtitleTimestampInputProps {
  valueMs: number;
  onCommit: (ms: number) => void;
}

export function formatMs(ms: number) {
  return new Time(ms).toTimestamp(Time.FORMATS.STANDARD_WITH_MS);
}

export default function SubtitleTimestampInput(props: SubtitleTimestampInputProps) {
  const [text, setText] = useState(() => formatMs(props.valueMs));
  const [focused, setFocused] = useState(false);
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    if (!focused) {
      setText(formatMs(props.valueMs));
      setInvalid(false);
    }
  }, [props.valueMs, focused]);

  const commit = () => {
    setFocused(false);
    try {
      const time = Time.fromTimestamp(text);
      setInvalid(false);
      props.onCommit(time.valueOf());
    } catch {
      setText(formatMs(props.valueMs));
      setInvalid(false);
    }
  };

  return (
    <TextInput
      size="xs"
      w={104}
      className="subtitle-editor-timestamp"
      error={invalid || undefined}
      value={text}
      onFocus={() => setFocused(true)}
      onChange={e => {
        setText(e.currentTarget.value);
        try {
          Time.fromTimestamp(e.currentTarget.value);
          setInvalid(false);
        } catch {
          setInvalid(true);
        }
      }}
      onBlur={commit}
      onKeyDown={e => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
    />
  );
}
