import React, { Component } from 'react';
import FormInput from './FormInputFields/FormInput';
import "./Form.scss";

type FormValue = string | string[] | boolean | number;

interface Props {
  onSubmit: (event: React.FormEvent<HTMLFormElement>, formValues: { [key: string]: FormValue }) => void,
  saveButtonText?: string;
  hideSubmit?: boolean;
}

export default class Form extends Component<Props> {
  constructor(props: Props) {
    super(props);
  }

  public submit() {
    this.formSubmitBtn.click();
  }

  private form: HTMLFormElement;
  private formSubmitBtn: HTMLButtonElement;

  render() {
    return (
      <form ref={ref => this.form = ref} onSubmit={e => {
        e.preventDefault();
        let fd = new FormData(e.currentTarget);
        let entries: [string, any][] = Array.from(fd.entries());
        const params: { [key: string]: FormValue } = {};
        for (let i = 0; i < entries.length; i++) {
          let [key, value] = entries[i];
          let type = "string";
          let _d = FormInput.getNameAndType(key);
          key = _d.name;
          type = _d.type;
          value = FormInput.getValue(type, value);


          params[key] = value;
        }

        this.props.onSubmit(e, params);
      }} method="post">
        {this.props.children}
        <button ref={ref => this.formSubmitBtn = ref} hidden={this.props.hideSubmit ?? false} type="submit" className="tx-btn tx-btn-action form-submit-btn">
          <i className="fas fa-save"></i>
          &nbsp;
            {this.props.saveButtonText ?? "Submit"}
        </button>
      </form>
    )
  }
}
