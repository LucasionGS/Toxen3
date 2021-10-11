import React from 'react';
import Settings from '../../../toxen/Settings';
import { remote } from "electron";
import "./FormInput.scss";
import FormInputColorPicker from './FormInputColorPicker';
import FormInputSelect from './FormInputSelect';
import JSONX from '../../../toxen/JSONX';
import { OptionValues } from "./FormInputSelect";
import FormInputList from './FormInputList';
import FormInputCheckbox from './FormInputCheckbox';
import Expandable from '../../Expandable/Expandable';

type Props = [
  PropsTypeText,
  PropsTypePassword,
  PropsTypeNumber,
  PropsTypeFile,
  PropsTypeFolder,
  PropsTypeCheckbox,
  PropsTypeExpandCheckbox,
  PropsTypeSelect,
  PropsTypeSelectAsync,
  PropsTypeList,
  PropsTypeColor,
][number];

interface PropsTemplate<T extends string> {
  name: `${string}*${"string" | "boolean" | "number" | "array" | "list" | "select"}`;
  type: T;
  displayName?: string;
  /**
   * If not defined, will use settings default value.
   */
  getValueTemplateCallback?: () => any;
}

interface PropsTypeText extends PropsTemplate<"text"> {
  readOnly?: boolean;
}

interface PropsTypePassword extends PropsTemplate<"password"> {
  readOnly?: boolean;
}
interface PropsTypeNumber extends PropsTemplate<"number"> {
  readOnly?: boolean;
  min?: number;
  max?: number;
}
interface PropsTypeFile extends PropsTemplate<"file"> {
  parseOutput?: (value: string) => string
}
interface PropsTypeFolder extends PropsTemplate<"folder"> {
  parseOutput?: (value: string) => string
}
interface PropsTypeCheckbox extends PropsTemplate<"checkbox"> { }
interface PropsTypeExpandCheckbox extends PropsTemplate<"expandCheckbox"> { }
interface PropsTypeSelect extends PropsTemplate<"select"> { }
interface PropsTypeSelectAsync extends PropsTemplate<"selectAsync"> {
  values: Promise<OptionValues> | (() => Promise<OptionValues>);
  nullable?: boolean;
}
interface PropsTypeList extends PropsTemplate<"list"> { }
interface PropsTypeColor extends PropsTemplate<"color"> {
  onChange?: (value: string) => void;
  nullable?: boolean;
}

export default class FormInput extends React.Component<Props> {

  constructor(props: Props) {
    super(props);

    this.state = {};
  }

  public static getNameAndType(nameAndType: string) {
    let type: string = null;
    if (nameAndType.indexOf("*") > -1) {
      [nameAndType, type] = nameAndType.split("*"); // Assign special type.
    }
    return {
      name: nameAndType,
      type
    };
  }

  public static getValue(type: string, value: any): any {
    switch (type) {
      case "number":
        return Number(value);

      case "array":
      case "list":
        return JSON.parse(String(value));

      case "boolean":
        if (value === "1") return true;
        if (value === "0") return false;
        return Boolean(value);

      case "select":
      case "string":
        return String(value);
    }
  }

  public static toStringValue(type: string, value: any): string {
    switch (type) {
      case "number":
        return String(value);

      case "boolean":
        return value ? "1" : "0";

      default:
        return value;
    }
  }

  render() {
    let { name } = FormInput.getNameAndType(this.props.name);
    let value: any = "";
    let dataTemplate = (typeof this.props.getValueTemplateCallback == "function" ? this.props.getValueTemplateCallback() : Settings.data);

    value = JSONX.getObjectValue(dataTemplate, name) ?? "";

    let label = (<label htmlFor={this.props.name}>{this.props.displayName ? this.props.displayName : name}</label>);
    switch (this.props.type) {
      case "password":
      case "text": {
        const ref = React.createRef<HTMLInputElement>();
        this.openFile = this.createOpenFile(ref);
        this.openFolder = this.createOpenFolder(ref);
        return (
          <>
            {label}
            <br />
            <input ref={ref} className={"tx-form-field" + (this.props.readOnly ? " read-only" : "")} type={this.props.type} name={this.props.name} defaultValue={value} readOnly={this.props.readOnly} />
            <br />
            <br />
          </>
        )
      }

      case "number": {
        return (
          <>
            {label}
            <br />
            <input className={"tx-form-field" + (this.props.readOnly ? " read-only" : "")} type="number" name={this.props.name} defaultValue={value} readOnly={this.props.readOnly} max={this.props.max} min={this.props.min} />
            <br />
            <br />
          </>
        )
      }

      case "file": {
        const ref = React.createRef<HTMLInputElement>();
        return (
          <>
            {label}
            <br />
            <input
              placeholder="Click to select file"
              title="Click to select file"
              ref={ref} className="tx-form-field" type="text" readOnly name={this.props.name} defaultValue={value} onClick={
                () => {
                  let value = remote.dialog.showOpenDialogSync(remote.getCurrentWindow(), {
                    properties: [
                      'openFile'
                    ]
                  });
                  if (value) {
                    const parseOutput = (this.props as PropsTypeFile).parseOutput;
                    ref.current.value = typeof parseOutput === "function" ? parseOutput(value[0]) : value[0];
                  }
                }
              } />
            <br />
            <br />
          </>
        )
      }

      case "folder": {
        const ref = React.createRef<HTMLInputElement>();
        this.openFolder = this.createOpenFolder(ref);
        return (
          <>
            {label}
            <br />
            <input
              placeholder="Click to select folder"
              title="Click to select folder"
              ref={ref} className="tx-form-field" type="text" readOnly name={this.props.name} defaultValue={value} onClick={
                this.openFolder
              } />
            <br />
            <br />
          </>
        )
      }

      case "checkbox": {
        return (
          <>
            <FormInputCheckbox name={this.props.name} defaultChecked={value} >
              {label}
            </FormInputCheckbox>
            <br />
          </>
        )
      }

      case "expandCheckbox": {
        const ref = React.createRef<Expandable>();
        return (
          <>
            <Expandable showBorder={false} showArrow={false} expanded={value} ref={ref} title={
              <FormInputCheckbox name={this.props.name} defaultChecked={value} onChange={(e, s) => ref.current.toggle(s)}>
                {label}
              </FormInputCheckbox>
            }
            disabled={true}
            >
              {this.props.children}
            </Expandable>
            <br />
          </>
        )
      }

      case "select": {
        return (
          <>
            {label}
            <br />
            <FormInputSelect name={this.props.name} defaultValue={value} >
              {this.props.children}
            </FormInputSelect>
            <br />
          </>
        )
      }

      case "selectAsync": {
        return (
          <>
            {label}
            <br />
            <FormInputSelect nullable={this.props.nullable} name={this.props.name} defaultValue={value} asyncValues={typeof this.props.values === "function" ? this.props.values() : this.props.values} />
            {this.props.children}
            <br />
            <br />
          </>
        )
      }

      case "list": {
        return (
          <>
            {label}
            <br />
            <FormInputList name={this.props.name} defaultValue={value} />
            <br />
            <br />
          </>
        )
      }

      case "color": {
        return (
          <>
            {label}
            <br />
            <FormInputColorPicker nullable={this.props.nullable} onChange={this.props.onChange} name={this.props.name} defaultValue={value} />
            <br />
            {/* <br /> */}
          </>
        )
      }
    }
  }
  public openFile() {
    throw new Error("Unable to open File. Function not redefined.");
  }
  public openFolder() {
    throw new Error("Unable to open folder. Function not redefined.");
  }

  private createOpenFile(ref: React.RefObject<HTMLInputElement>) {
    return () => {
      let value = remote.dialog.showOpenDialogSync(remote.getCurrentWindow(), {
        properties: [
          'openFile'
        ]
      });
      if (value) {
        const parseOutput = (this.props as PropsTypeFile).parseOutput;
        ref.current.value = typeof parseOutput === "function" ? parseOutput(value[0]) : value[0];
      }
    }
  }

  private createOpenFolder(ref: React.RefObject<HTMLInputElement>) {
    return () => {
      let value = remote.dialog.showOpenDialogSync(remote.getCurrentWindow(), {
        properties: [
          'openDirectory'
        ]
      });
      if (value) {
        const parseOutput = (this.props as PropsTypeFile).parseOutput;
        ref.current.value = typeof parseOutput === "function" ? parseOutput(value[0]) : value[0];
      }
    }
  }
}
