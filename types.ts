export type ControlType =
  | 'Button'
  | 'Label'
  | 'TextBox'
  | 'GroupBox'
  | 'ListBox'
  | 'ComboBox'
  | 'CheckBox'
  | 'RadioButton'
  | 'ProgressBar'
  | 'RichTextBox'
  | 'TrackBar'
  | 'Panel'
  | 'MaskedTextBox'
  | 'LinkLabel'
  | 'DateTimePicker'
  | 'SplitContainer';

export interface MenuItem {
  id: string;
  text: string;
  name: string;
  items?: MenuItem[];
}

export interface FormProperties {
  Name: string;
  Text: string;
  Location: { X: number; Y: number }; // Canvas position, not for code gen
  Size: { Width: number; Height: number };
  StartPosition?: 'CenterScreen';
  menu?: MenuItem[];
}

export interface ControlProperties {
  Name:string;
  Text?: string;
  Location: { X: number; Y: number };
  Size: { Width: number; Height: number };
  Items?: string[];
  Checked?: boolean;
  Value?: number;
  Minimum?: number;
  Maximum?: number;
  BorderStyle?: 'None' | 'FixedSingle' | 'Fixed3D' | 'Sunken';
  Placeholder?: string;
  Mask?: string;
  URL?: string;
  Format?: 'Long' | 'Short' | 'Time' | 'Custom';
  Orientation?: 'Vertical' | 'Horizontal';
  SplitterDistance?: number;
  events?: { 
    [eventName: string]: {
      powershell?: string;
      python?: string;
    }; 
  };
  [key: string]: any;
}

export interface Control {
  id: string;
  type: ControlType;
  properties: ControlProperties;
  parentId?: string;
  splitterPanel?: 1 | 2;
}

export interface FormState {
  id:string;
  isEnabled: boolean;
  properties: FormProperties;
  controls: Control[];
}

export interface Ripple {
  id: number;
  x: number;
  y: number;
  type: 'ripple' | 'wormhole';
}

// FIX: Removed ApiKeyMap as API key management via UI is disallowed.
