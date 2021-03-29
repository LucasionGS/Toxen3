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
  vertical?: boolean;
  setVertical?: ((setVertical: React.Dispatch<React.SetStateAction<boolean>>) => void);
}

export default function Sidepanel(props: Props) {
  const sections: SidepanelSection[] = (Array.isArray(props.children) ? props.children : [props.children]) as any[];
  const [show, setShow] = useState(typeof props.toggle === "boolean" ? props.toggle : false);
  const [sectionId, setSectionId] = useState(props.sectionId ?? sections[0]?.props?.id);
  const [vertical, setVertical] = useState(props.vertical ?? false);
  const classList: string[] = [
    "sidepanel",
    `sidepanel-${props.direction}`
  ];

  if (vertical) classList.push("vertical");
  if (show) classList.push("show");

  if (typeof props.toggle === "function") props.toggle(setShow);
  if (typeof props.setSectionId === "function") props.setSectionId(setSectionId);
  if (typeof props.setVertical === "function") props.setVertical(setVertical);

  let sec = sections.find(sec => sec?.props?.id == sectionId);
  return (
    <div className={classList.join(" ")}>
      <div className="sidepanel-icons">
        <div className="sidepanel-icon sidepanel-icon-close" onClick={
          typeof props.onClose === "function" ? props.onClose : null
        }>
          <i className="far fa-times-circle"></i>
          <span className="sidepanel-icon-title">&nbsp;Close</span>
        </div>
        {sections.map((s, i) => (s.props.icon || s.props.title) && (
          <>
            {s.props.separator === true ? (<hr />) : ""}
            <div key={i} className="sidepanel-icon" onClick={() => setSectionId(s.props.id)}>
              {s.props.icon}
              {s.props.title && (<span className="sidepanel-icon-title">&nbsp;{s.props.title}</span>)}
            </div>
          </>))}
      </div>
      {sec ?
        <>
          <div className="sidepanel-content">{sec}</div>
        </>
        : ""}
    </div>
  )
}
