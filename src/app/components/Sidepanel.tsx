import React, { useState } from 'react';
import "./Sidepanel.css";
import SidepanelSection from './SidepanelSection';

interface Props {
  direction: "left" | "right";
  children: React.ReactElement<SidepanelSection> | React.ReactElement<SidepanelSection>[];
  toggle?: boolean | ((setShow: React.Dispatch<React.SetStateAction<boolean>>) => void);
  /**
   * Initial value to show on the menu.
   */
  sectionId?: any;
  setSectionId?: ((setSectionId: React.Dispatch<any>) => void);
  onClose?: (() => void);
}

export default function Sidepanel(props: Props) {
  const sections: SidepanelSection[] = (Array.isArray(props.children) ? props.children : [props.children]) as any[];
  const [show, setShow] = useState(typeof props.toggle === "boolean" ? props.toggle : false);
  const [sectionId, setSectionId] = useState(props.sectionId ?? sections[0]?.props?.id);
  const classList: string[] = [
    "sidepanel",
    `sidepanel-${props.direction}`
  ];

  if (show) classList.push("show");

  if (typeof props.toggle === "function") props.toggle(setShow);
  if (typeof props.setSectionId === "function") props.setSectionId(setSectionId);

  let sec = sections.find(sec => sec?.props?.id == sectionId);
  return (
    <div className={classList.join(" ")}>
      <div className="sidepanel-icons">
      <div className="sidepanel-icon sidepanel-icon-close" onClick={
          typeof props.onClose === "function" ? props.onClose : null
        }>
        <i className="fas fa-times-circle"></i>
      </div>
        {sections.map((s, i) => (<div key={i} className="sidepanel-icon" onClick={() => setSectionId(s.props.id)}>{s.props.icon}</div>))}
        </div>
      {sec ?
        <>
          <div className="content">{sec}</div>
        </>
        : ""}
    </div>
  )
}
