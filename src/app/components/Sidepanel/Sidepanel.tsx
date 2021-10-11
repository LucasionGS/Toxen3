import { remote } from 'electron';
import React, { useState } from 'react';
import Asyncifier from '../../toxen/Asyncifier';
import { Toxen } from '../../ToxenApp';
import "./Sidepanel.scss";
import SidepanelSection from './SidepanelSection';

export type PanelDirection = "left" | "right";

interface Props {
  children: React.ReactElement<SidepanelSection> | React.ReactElement<SidepanelSection>[];
  direction?: PanelDirection;
  show?: boolean;
  exposeIcons?: boolean;
  /**
   * Initial value to show on the menu.
   */
  sectionId?: string;
  vertical?: boolean;
  width?: number;
  onClose?: (() => void);
  onResizeFinished?: ((width: number) => void);
}

interface State {
  show: boolean;
  sectionId: string;
  vertical: boolean;
  direction: PanelDirection;
  exposeIcons: boolean;
  width: number;
}

export default class Sidepanel extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      show: (typeof this.props.show === "boolean" ? this.props.show : false),
      sectionId: (this.props.sectionId ?? this.sections[0]?.props?.id),
      vertical: (this.props.vertical ?? false),
      direction: (this.props.direction ?? "left"),
      exposeIcons: (this.props.exposeIcons ?? false),
      width: this.getWidth(),
    }
  }

  public async reloadSection() {
    let id = this.state.sectionId;
    await this.setSectionId("$empty");
    await this.setSectionId(id);
    // setTimeout(() => {
    // }, 0);
  }

  private getWidth() {
    return this.state?.width ?? remote.getCurrentWindow().getSize()[0] / 2;
  }

  /**
   * Centers the panel on the screen.
   */
  private resetWidth() {
    return this.setWidth(remote.getCurrentWindow().getSize()[0] / 2);
  }

  private sections: SidepanelSection[] = (Array.isArray(this.props.children) ? this.props.children : [this.props.children]) as any[];

  public async show(force?: boolean) {
    let value = force ?? !this.state.show;
    await this.setStateAsync({
      show: value
    });
    return value;
  }

  public isShowing() {
    return this.state.show;
  }

  setStateAsync = Asyncifier.createSetState(this);

  public setSectionId(sectionId: string) {
    return this.setStateAsync({
      sectionId
    });
  }

  public getSectionId() {
    return this.state.sectionId;
  }

  public setVertical(vertical: boolean) {
    return this.setStateAsync({
      vertical
    });
  }

  public setDirection(direction: PanelDirection) {
    return this.setStateAsync({
      direction
    });
  }

  public setExposeIcons(exposeIcons: boolean) {
    return this.setStateAsync({
      exposeIcons
    });
  }

  public setWidth(width: number) {
    return this.setStateAsync({
      width: width ?? this.getWidth()
    });
  }

  public storeScroll(scrollY: number) {
    let id = this.state.sectionId;
    this.scrollStorage[id] = scrollY;
  }

  public scrollStorage: { [sectionId: string]: number } = {};

  render() {
    const classList: string[] = [
      "sidepanel",
      `sidepanel-${this.state.direction}`
    ];

    if (this.state.vertical) classList.push("vertical");
    if (this.state.show) classList.push("show");
    if (this.state.exposeIcons) classList.push("expose-icons");

    let panelWidth: string;
    let panelIconsWidth: string = "168px";

    if (this.state.show) {
      panelWidth = (Math.max(200, this.getWidth())) + "px";
    }
    else {
      if (!this.state.exposeIcons) {
        panelWidth = "0px";
      }
      else {
        panelWidth = "3.7em" // this will show icons instead of full hide on sidebar.
      }
    }

    let sec = this.sections.find(sec => sec?.props?.id == this.state.sectionId);
    return (
      <div className={classList.join(" ")}
        style={{
          width: panelWidth,
          maxWidth: "100vw"
        }}>
        <div className="sidepanel-backdrop" onClick={() => this.show(false)}></div>
        <div className="sidepanel-icons" onClick={() => this.state.show || this.show(true)}>
          <div className="sidepanel-icon sidepanel-icon-toggle" onClick={e => {
            e.preventDefault();
            e.stopPropagation();
            if (typeof this.props.onClose === "function") this.props.onClose();
          }}>
            <i className="far fa-times-circle"></i>
            {
              this.state.show ?
                <span className="sidepanel-icon-title">&nbsp;Close</span>
                : <span className="sidepanel-icon-title">&nbsp;Show</span>
            }
          </div>
          {this.sections.map(s => (s.props.icon || s.props.title) && (
            <div key={String(s.props.id)}>
              {s.props.separator === true ? (<hr />) : ""}
              <div className={(() => {
                const classes = [
                  "sidepanel-icon"
                ];
                if (s.props.disabled) classes.push("sidepanel-icon-disabled")
                return classes.join(" ");
              })()} title={s.props.title} onClick={s.props.disabled ? null : (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!Toxen.isMode("Player")) {
                  Toxen.sendError("CURRENTLY_EDITING_SONG");
                  Toxen.sidePanel.show(true);
                  return;
                }
                this.setSectionId(s.props.id);
                if (this.state.exposeIcons && !this.state.show) this.show(true);
              }}
                style={{
                  width: panelIconsWidth
                }}>
                {s.props.icon}
                {s.props.title && (<span className="sidepanel-icon-title">&nbsp;{s.props.title}</span>)}
              </div>
            </div>))}
        </div>
        {sec ?
          <div
            className="sidepanel-content"
            onScroll={e => this.scrollStorage[this.state.sectionId] = e.currentTarget.scrollTop}
            ref={ref => {
              if (ref) {
                ref.scrollTo(0, this.scrollStorage[this.state.sectionId] ?? 0);
              }
            }}
            style={{
              width: this.state.show ? "100%" : "0px"
            }}
          >{sec}</div>
          : ""}
        {(() => {
          let holding = false;

          const upHandler = () => {
            window.removeEventListener("mousemove", moveHandler);
            window.removeEventListener("mouseup", upHandler);
            holding = false;
            if (typeof this.props.onResizeFinished === "function") this.props.onResizeFinished(this.state.width);
          }

          const moveHandler = (e: MouseEvent) => {
            this.setWidth(e.clientX + 4);
          }

          return (<div className="sidepanel-resizer" onMouseDown={e => {
            e.preventDefault();
            holding = true;
            window.addEventListener("mousemove", moveHandler);
            window.addEventListener("mouseup", upHandler);
          }}

            onDoubleClick={async e => {
              e.preventDefault();
              await this.resetWidth();
              if (typeof this.props.onResizeFinished === "function") this.props.onResizeFinished(this.state.width);
            }}
          />);
        })()}
      </div>
    )
  }
}
