import React, { Component } from "react";
import "./Modal.scss";

interface ModalProps { }
interface ModalState { }

export default class Modal extends Component<ModalProps, ModalState> {
  constructor(props: ModalProps) {
    super(props);
    this.state = {};
  }
  
  render() {
    return (
      <div className="modal">
        <div className="modal_content">
          <div className="modal_header">
            <h2>Modal Header</h2>
            <span className="close" onClick={this.closeModal}>&times;</span>
          </div>
          <div className="modal_body">
            {this.props.children}
          </div>
          <div className="modal_footer">
            <h3>Modal Footer</h3>
          </div>
        </div>
      </div>
    );
  }
  
  private closeModal = () => {
    document.querySelector(".modal").classList.remove("show");
  }
}