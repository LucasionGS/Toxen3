import React from 'react';
import './SidepanelSectionGroup.scss';

interface Props {
  title?: string;
  children: React.ReactNode;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  icon?: React.ReactElement;
}

interface State {
  collapsed: boolean;
}

export default class SidepanelSectionGroup extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      collapsed: props.defaultCollapsed ?? false
    };
  }

  render() {
    const { title, children, collapsible, icon } = this.props;
    const { collapsed } = this.state;

    return (
      <div className={`sidepanel-section-group ${collapsed ? 'collapsed' : ''}`}>
        {title && (
          <div 
            className={`sidepanel-section-group-header ${collapsible ? 'clickable' : ''}`}
            onClick={collapsible ? () => this.setState({ collapsed: !collapsed }) : undefined}
          >
            <div className="header-content">
              {icon && <span className="header-icon">{icon}</span>}
              <h3>{title}</h3>
            </div>
            {collapsible && (
              <i className={`fas fa-chevron-${collapsed ? 'down' : 'up'}`}></i>
            )}
          </div>
        )}
        <div className="sidepanel-section-group-content">
          {children}
        </div>
      </div>
    );
  }
}
