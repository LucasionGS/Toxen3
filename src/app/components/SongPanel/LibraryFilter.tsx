import React from "react";
import { SegmentedControl } from "@mantine/core";
import { setLibraryFilter, useLibraryFilter } from "../Sync/libraryFilter";
import type { LibraryFilter as Filter } from "../Sync/libraryFilter";
import "./LibraryFilter.scss";

/**
 * Compact All / On this device / Cloud only switch above the song list. Desktop only, since the web library is all cloud.
 */
export default function LibraryFilter() {
  const filter = useLibraryFilter();
  if (!toxenapi.isDesktop()) return null;
  return (
    <div className="library-filter">
      <SegmentedControl
        fullWidth
        size="xs"
        value={filter}
        onChange={value => setLibraryFilter(value as Filter)}
        data={[
          { value: "all", label: "All" },
          { value: "device", label: "On this device" },
          { value: "cloud", label: "Cloud only" },
        ]}
      />
    </div>
  );
}
