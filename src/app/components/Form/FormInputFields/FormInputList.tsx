import React, { Component } from 'react'
import "./FormInputList.scss";

interface FormInputListProps {
  name: string;
  defaultValue?: string | string[];
  children?: React.ReactNode;
  onChange?: (value: string[]) => void;
}

interface FormInputListState {
  value: string[];
}

export default class FormInputList extends Component<FormInputListProps, FormInputListState> {
  constructor(props: FormInputListProps) {
    super(props);

    let list: string[] = [];
    if (typeof this.props.defaultValue === "string") {
      list = this.props.defaultValue.split(" ");
    }
    if (typeof this.props.defaultValue === "object" && Array.isArray(this.props.defaultValue)) {
      list = this.props.defaultValue.map(_ => _);
    }

    this.state = {
      value: list.filter(item => item.trim()).sort()
    }
  }


  public add(entry: string) {
    if (!entry.trim()) return;

    entry = entry.replace(/\s/g, "_");
    
    let list = this.state.value;
    let exists = list.some(item => entry === item);
    if (!exists) {
      list.push(entry);
      this.setState({
        value: list.sort()
      });
    }
  }

  public remove(entry: string) {
    let list = this.state.value;
    let i = list.findIndex(item => entry === item);
    if (i > -1) list.splice(i, 1);
    this.setState({
      value: list
    });
  }

  componentDidUpdate(prevProps: Readonly<FormInputListProps>, prevState: Readonly<FormInputListState>, snapshot?: any): void {
    if (this.props.onChange && prevState.value !== this.state.value) {
      this.props.onChange(this.state.value);
    }
  }

  render() {
    let inputRef: HTMLInputElement;

    return (
      <div className="form-input-list">
        <input
          type="hidden"
          className="tx-form-field"
          name={this.props.name} value={JSON.stringify(this.state.value)}
          readOnly
        />
        <input ref={ref => inputRef = ref} className="tx-form-field" type="text" onKeyDown={e => {
          if (e.key == "Enter") {
            e.preventDefault();
            if (e.currentTarget.value.trim()) {
              this.add(e.currentTarget.value.trim());
              e.currentTarget.value = "";
            }
          }
        }}
          onChange={e => {
            // let withUnderscore = e.currentTarget.value.replace(/\s/g, "_");
            // if (e.currentTarget.value !== withUnderscore) {
            //   let start = e.currentTarget.selectionStart;
            //   let end = e.currentTarget.selectionEnd;

            //   e.currentTarget.value = withUnderscore;
            //   e.currentTarget.setSelectionRange(start, end);
            // }
          }}
        /><button className="tx-btn" onClick={() => {
          if (inputRef.value.trim()) {
            this.add(inputRef.value.trim());
            inputRef.value = "";
          }
        }}>Add</button>
        <div className="form-input-list-items">
          {this.state.value.map(v => (
            <div key={v} className="form-input-list-item" onClick={() => this.remove(v)} >
              {v.replace(/_/g, " ")}
              <div className="form-input-list-item-remove">✖</div>
            </div>
          ))}
        </div>
      </div>
    );
  }
}
