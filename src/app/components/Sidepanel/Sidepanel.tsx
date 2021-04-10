import React, { useState } from 'react';
import { Toxen } from '../../ToxenApp';
import "./Sidepanel.scss";
import SidepanelSection from './SidepanelSection';

export type PanelDirection = "left" | "right";

interface Props {
  children: React.ReactElement<SidepanelSection> | React.ReactElement<SidepanelSection>[];
  direction?: PanelDirection;
  show?: boolean;
  exposeIcons?: boolean;
  getRef?: (sidepanel: Sidepanel) => void;
  /**
   * Initial value to show on the menu.
   */
  sectionId?: string;
  vertical?: boolean;
  onClose?: (() => void);
}

interface State {
  show: boolean;
  sectionId: string;
  vertical: boolean;
  direction: PanelDirection;
  exposeIcons: boolean;
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
    }
  }

  componentDidMount() {
    if (typeof this.props.getRef === "function") this.props.getRef(this);
  }

  private sections: SidepanelSection[] = (Array.isArray(this.props.children) ? this.props.children : [this.props.children]) as any[];

  public show(force?: boolean) {
    let value = force ?? !this.state.show;
    this.setState({
      show: value
    });
    return value;
  }

  public isShowing() {
    return this.state.show;
  }

  public setSectionId(sectionId: string) {
    this.setState({
      sectionId
    });
  }

  public setVertical(vertical: boolean) {
    this.setState({
      vertical
    });
  }

  public setDirection(direction: PanelDirection) {
    this.setState({
      direction
    });
  }

  public setExposeIcons(exposeIcons: boolean) {
    this.setState({
      exposeIcons
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


    let sec = this.sections.find(sec => sec?.props?.id == this.state.sectionId);
    return (
      <div className={classList.join(" ")}>
        <div className="sidepanel-backdrop" onClick={() => this.show(false)}></div>
        <div className="sidepanel-icons">
          <div className="sidepanel-icon sidepanel-icon-toggle" onClick={
            typeof this.props.onClose === "function" ? this.props.onClose : null
          }>
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
              <div className="sidepanel-icon" title={s.props.title} onClick={() => {
                this.setSectionId(s.props.id);
                if (this.state.exposeIcons) this.state.show || this.show(true);
              }}>
                {s.props.icon}
                {s.props.title && (<span className="sidepanel-icon-title">&nbsp;{s.props.title}</span>)}
              </div>
            </div>))}
        </div>
        {sec ?
          <>
            <div
              className="sidepanel-content"
              onScroll={e => this.scrollStorage[this.state.sectionId] = e.currentTarget.scrollTop}
              ref={ref => {
                if (ref) {
                  ref.scrollTo(0, this.scrollStorage[this.state.sectionId] ?? 0);
                }
              }}
            >{sec}</div>
          </>
          : ""}
      </div>
    )
  }
}
