import React, { useState } from 'react';
import { IconDots } from '@tabler/icons-react';
import type SidepanelSection from '../Sidepanel/SidepanelSection';
import "./MobileUI.scss";

/**
 * Sections that get their own tab in the bottom bar. Everything else with a
 * title/icon lands in the "More" sheet.
 */
const PRIMARY_SECTIONS = ["songPanel", "playlist", "effects"];

interface MobileNavBarProps {
  sections: SidepanelSection[];
  activeId: string;
  panelOpen: boolean;
  onSelect: (sectionId: string) => void;
}

/**
 * Mobile web bottom navigation: labelled tabs for the main sections plus a
 * "More" bottom sheet holding the remaining sidepanel sections. Only visible
 * at phone widths (see MobileUI.scss).
 */
export default function MobileNavBar(props: MobileNavBarProps) {
  const { sections, activeId, panelOpen, onSelect } = props;
  const [sheetOpen, setSheetOpen] = useState(false);

  const visibleSections = sections.filter(s => s?.props && (s.props.icon || s.props.title));
  const primary = PRIMARY_SECTIONS
    .map(id => visibleSections.find(s => s.props.id === id))
    .filter(Boolean);
  const more = visibleSections.filter(s => !PRIMARY_SECTIONS.includes(s.props.id));

  const isActive = (id: string) => panelOpen && activeId === id;
  const moreActive = more.some(s => isActive(s.props.id));

  const select = (id: string) => {
    setSheetOpen(false);
    onSelect(id);
  };

  return (
    <>
      <nav className="mobile-navbar">
        {primary.map(s => (
          <div
            key={String(s.props.id)}
            className={"mobile-navbar-tab" + (isActive(s.props.id) ? " active" : "")}
            onClick={() => select(s.props.id)}
          >
            {s.props.icon}
            <span className="mobile-navbar-tab-label">{s.props.title}</span>
          </div>
        ))}
        <div
          className={"mobile-navbar-tab" + (moreActive || sheetOpen ? " active" : "")}
          onClick={() => setSheetOpen(!sheetOpen)}
        >
          <IconDots size="1em" />
          <span className="mobile-navbar-tab-label">More</span>
        </div>
      </nav>
      <div className={"mobile-sheet-scrim" + (sheetOpen ? " open" : "")} onClick={() => setSheetOpen(false)} />
      <div className={"mobile-sheet" + (sheetOpen ? " open" : "")}>
        <div className="mobile-sheet-handle" />
        {more.map(s => {
          const classes = ["mobile-sheet-item"];
          if (s.props.disabled) classes.push("disabled");
          if (s.props.advancedOnly) classes.push("advanced-only");
          return (
            <div
              key={String(s.props.id)}
              className={classes.join(" ")}
              onClick={s.props.disabled ? undefined : () => select(s.props.id)}
            >
              <span className="mobile-sheet-item-icon">{s.props.icon}</span>
              <span className="mobile-sheet-item-title">{s.props.title}</span>
              {s.props.disabled && <span className="mobile-sheet-item-tag">Desktop only</span>}
            </div>
          );
        })}
      </div>
    </>
  );
}
