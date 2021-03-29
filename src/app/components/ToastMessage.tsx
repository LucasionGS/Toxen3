import React from 'react';
import Toast from "react-bootstrap/Toast";
import Time from "../toxen/Time"

interface Props {
  title?: string;
}

interface State {
  // timeSince: Time;
  showing: boolean;
}

export default class ToastMessage extends React.Component<Props, State>{
  constructor(props: Props) {
    super(props);

    this.state = {
      showing: true
    }
  }

  close() {
    this.setState({
      showing: false
    });
  }

  show() {
    this.setState({
      showing: true
    });
  }

  componentDidMount() {

  }

  render() {
    return (
      <Toast show={this.state.showing} onClose={this.close.bind(this)}>
        <Toast.Header>
          {this.props.title && <strong className="mr-auto">{this.props.title}</strong>}
          <small>11 mins ago</small>
        </Toast.Header>
        <Toast.Body>{this.props.children}</Toast.Body>
      </Toast>
    );
  }
}