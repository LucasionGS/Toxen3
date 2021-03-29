import React, { Component } from 'react';
import SettingsInput from './SettingsInput';

interface Props {
  onSubmit: (event: React.FormEvent<HTMLFormElement>, formValues: { [key: string]: FormDataEntryValue }) => void
}

export default class SettingsForm extends Component<Props> {
  constructor(props: Props) {
    super(props);
  }

  render() {
    return (
      <form onSubmit={e => {
        e.preventDefault();
        let fd = new FormData(e.currentTarget);
        let entries: [string, any][] = Array.from(fd.entries());
        const params: { [key: string]: FormDataEntryValue } = {};
        for (let i = 0; i < entries.length; i++) {
          let [key, value] = entries[i];
          let type = "string";
          let _d = SettingsInput.getNameAndType(key);
          key = _d.name;
          type = _d.type;
          value = SettingsInput.getValue(type, value);


          params[key] = value;
        }

        this.props.onSubmit(e, params);
      }} method="post">
        {this.props.children}
        <button type="submit" className="tx-btn tx-btn-success">
          <i className="fas fa-save"></i>
          &nbsp;
          Save settings
        </button>
      </form>
    )
  }
}
