import React from 'react';

interface Props {
  id: any;
  icon?: React.ReactElement<"i">;
}

class SidepanelSection extends React.Component<Props> {
  render() {
    return (
      <div>
        {this.props.children}
      </div>
    )
  }
}

export default SidepanelSection;