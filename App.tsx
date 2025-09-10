import React, { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
// FIX: Removed ApiKeyMap as it's no longer used.
import { Control, ControlType, Ripple, MenuItem, FormState, FormProperties, ControlProperties } from './types';
import CodeEditor from './components/CodeEditor';
import { enhanceCodeWithAI } from './services/geminiService';
// FIX: Removed SettingsIcon as the settings modal is no longer used.
import { CodeIcon, TrashIcon, PlusIcon, WandIcon, GridIcon, MagnetIcon, CalendarIcon, LockIcon, UnlockIcon, CopyIcon, SaveIcon, MenuIcon, XIcon } from './components/icons';
// FIX: Removed imports related to API key management UI.

// --- LOCAL CODE GENERATOR (PowerShell) ---
const generatePowerShellMenuScript = (menuItems: MenuItem[], parentVar: string): string => {
  let script = '';
  menuItems.forEach(item => {
    const itemVar = `$${item.name}`;
    script += `\n# Menu Item: ${item.text}\n`;
    script += `${itemVar} = New-Object System.Windows.Forms.ToolStripMenuItem\n`;
    script += `${itemVar}.Text = '${item.text}'\n`;
    script += `${parentVar}.DropDownItems.Add(${itemVar}) | Out-Null\n`;
    if (item.items && item.items.length > 0) {
      script += generatePowerShellMenuScript(item.items, itemVar);
    }
  });
  return script;
};

const generateLocalPowerShellCode = (forms: FormState[]): string => {
  let script = `Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing\n\n`;

  const enabledForms = forms.filter(f => f.isEnabled);
  const allControls = enabledForms.flatMap(f => f.controls);

  const generateControlsRecursive = (controls: Control[], parentId: string | undefined, parentVar: string) => {
    let controlScript = '';
    const children = controls.filter(c => c.parentId === parentId);

    children.forEach(c => {
      const { Name, Text, Location, Size, Checked, Value, Minimum, Maximum, BorderStyle, Mask, URL, Format, events, Orientation, SplitterDistance } = c.properties;
      const varName = `$${Name}`;
      controlScript += `\n$${Name} = New-Object System.Windows.Forms.${c.type}\n`;
      controlScript += `${varName}.Name = '${Name}'\n`;
      if (Text !== undefined && c.type !== 'ListBox' && c.type !== 'ProgressBar' && c.type !== 'TrackBar' && c.type !== 'Panel' && c.type !== 'DateTimePicker' && c.type !== 'SplitContainer') {
        controlScript += `${varName}.Text = '${Text}'\n`;
      }
      controlScript += `${varName}.Location = New-Object System.Drawing.Point(${Location.X}, ${Location.Y})\n`;
      controlScript += `${varName}.Size = New-Object System.Drawing.Size(${Size.Width}, ${Size.Height})\n`;
      
      if (c.type === 'CheckBox' || c.type === 'RadioButton') {
          controlScript += `${varName}.Checked = ${Checked ? '$true' : '$false'}\n`;
      }
      if (c.type === 'ProgressBar' || c.type === 'TrackBar') {
          if(Minimum !== undefined) controlScript += `${varName}.Minimum = ${Minimum}\n`;
          if(Maximum !== undefined) controlScript += `${varName}.Maximum = ${Maximum}\n`;
          if(Value !== undefined) controlScript += `${varName}.Value = ${Value}\n`;
      }
      if (c.type === 'Panel' && BorderStyle) {
        controlScript += `${varName}.BorderStyle = [System.Windows.Forms.BorderStyle]::${BorderStyle}\n`;
      }
      if (c.type === 'MaskedTextBox' && Mask) {
          controlScript += `${varName}.Mask = '${Mask}'\n# Note: Placeholders are not natively supported in WinForms MaskedTextBox.\n`;
      }
      if (c.type === 'LinkLabel' && Text && URL) {
        controlScript += `${varName}.Links.Add(0, ${Text.length}, '${URL}') | Out-Null\n`;
      }
      if (c.type === 'DateTimePicker' && Format) {
        controlScript += `${varName}.Format = [System.Windows.Forms.DateTimePickerFormat]::${Format}\n`;
      }
       if (c.type === 'SplitContainer') {
        controlScript += `${varName}.Orientation = [System.Windows.Forms.Orientation]::${Orientation || 'Vertical'}\n`;
        controlScript += `${varName}.SplitterDistance = ${SplitterDistance || 150}\n`;
      }

      let finalParentCollection = `${parentVar}.Controls`;
      const parentControl = allControls.find(p => p.id === c.parentId);
      if (parentControl && parentControl.type === 'SplitContainer') {
          finalParentCollection = c.splitterPanel === 2
              ? `${parentVar}.Panel2.Controls`
              : `${parentVar}.Panel1.Controls`;
      }
      controlScript += `${finalParentCollection}.Add(${varName})\n`;
      
      if (c.type === 'LinkLabel') {
          controlScript += `${varName}.Add_LinkClicked({
    param($sender, $e)
    # The LinkData property holds the URL.
    if ($e.Link.LinkData) {
        [System.Diagnostics.Process]::Start($e.Link.LinkData)
    }
})\n`;
      }

      if (events) {
          Object.entries(events).forEach(([eventName, eventCodeObj]) => {
              const eventCode = (eventCodeObj as { powershell?: string, python?: string }).powershell;
              if (eventCode) {
                  controlScript += `${varName}.Add_${eventName}({\n    # User-defined code for ${Name}.${eventName}\n${eventCode.split('\n').map(l => `    ${l}`).join('\n')}\n})\n`;
              }
          });
      }

      if (c.type === 'GroupBox' || c.type === 'Panel' || c.type === 'SplitContainer') {
        controlScript += generateControlsRecursive(controls, c.id, varName);
      }
    });
    return controlScript;
  };

  enabledForms.forEach((formState, index) => {
    const { properties, controls } = formState;
    const formVar = `$${properties.Name}`;

    script += `# --- Form: ${properties.Name} ---\n`;
    script += `${formVar} = New-Object System.Windows.Forms.Form\n`;
    script += `${formVar}.Text = '${properties.Text}'\n`;
    script += `${formVar}.Name = '${properties.Name}'\n`;
    script += `${formVar}.Size = New-Object System.Drawing.Size(${properties.Size.Width}, ${properties.Size.Height})\n`;
    
    if (index === 0) {
        script += `${formVar}.StartPosition = 'CenterScreen'\n`;
    }

    if (properties.menu && properties.menu.length > 0) {
      script += `\n# --- Main Menu for ${properties.Name} --- \n`;
      script += `$mainMenu = New-Object System.Windows.Forms.MenuStrip\n`;
      script += generatePowerShellMenuScript(properties.menu, '$mainMenu.Items');
      script += `${formVar}.Controls.Add($mainMenu)\n`;
    }
    
    script += `\n# --- Controls for ${properties.Name} --- \n`;
    script += generateControlsRecursive(controls, undefined, formVar);
    script += '\n';
  });

  if (enabledForms.length > 0) {
    const mainFormVar = `$${enabledForms[0].properties.Name}`;
    script += `\n# --- Show Main Form ---
${mainFormVar}.Add_Shown({${mainFormVar}.Activate()})
[void]${mainFormVar}.ShowDialog()\n`;
  }

  return script;
};

// --- LOCAL CODE GENERATOR (Python) ---
type RadioGroupMap = { [parentId: string]: { varName: string; checkedVal: string | null } };

const createRadioGroups = (controls: Control[], formName: string): RadioGroupMap => {
    const radioGroups: RadioGroupMap = {};
    controls.forEach(c => {
        if (c.type === 'RadioButton') {
            const parentKey = c.parentId || 'root';
            if (!radioGroups[parentKey]) {
                const parentCtrl = controls.find(p => p.id === c.parentId);
                const varName = `${parentCtrl ? parentCtrl.properties.Name.replace(/\s+/g, '_') : formName}_radio_var`;
                radioGroups[parentKey] = { varName: varName, checkedVal: null };
            }
            if (c.properties.Checked) radioGroups[parentKey].checkedVal = c.properties.Name;
        }
    });
    return radioGroups;
};

const generateTkinterVariables = (controls: Control[], formProperties: FormProperties, radioGroups: RadioGroupMap): string => {
    let script = '';
    controls.forEach(c => {
        if (c.type === 'CheckBox') script += `        self.${c.properties.Name}_var = tk.BooleanVar(value=${c.properties.Checked ? 'True' : 'False'})\n`;
        if (c.type === 'TrackBar') script += `        self.${c.properties.Name}_var = tk.DoubleVar(value=${c.properties.Value || 0})\n`;
        if (['TextBox', 'MaskedTextBox', 'ComboBox'].includes(c.type)) script += `        self.${c.properties.Name}_var = tk.StringVar(value="${(c.properties.Text || '').replace(/"/g, '\\"')}")\n`;
    });
    Object.values(radioGroups).forEach(group => {
        script += `        self.${group.varName} = tk.StringVar()\n`;
        if (group.checkedVal) script += `        self.${group.varName}.set("${group.checkedVal}")\n`;
    });
    return script;
};

const generatePythonMenuScript = (menuItems: MenuItem[], parentVar: string): string => {
  let script = '';
  menuItems.forEach(item => {
    script += `\n# Menu Item: ${item.text}\n`;
    if (item.items && item.items.length > 0) {
      const menuVar = `${item.name}_menu`;
      script += `${menuVar} = tk.Menu(${parentVar}, tearoff=0)\n`;
      script += `${parentVar}.add_cascade(label="${item.text}", menu=${menuVar})\n`;
      script += generatePythonMenuScript(item.items, menuVar);
    } else {
      script += `${parentVar}.add_command(label="${item.text}", command=lambda: print("Menu item '${item.text}' clicked")) # TODO: Replace with actual command\n`;
    }
  });
  return script;
};

const generateLocalPythonCode = (forms: FormState[]): string => {
    let script = `import tkinter as tk
from tkinter import ttk
from tkinter import messagebox
from tkinter import font
import webbrowser\n`;

    const enabledForms = forms.filter(f => f.isEnabled);
    if (enabledForms.length === 0) return "# No enabled forms to generate.";
    
    // For Python, filter out SplitContainer and its descendants as it's not supported
    const getDescendantsPy = (controlId: string, controls: Control[]): Control[] => {
        const children = controls.filter(c => c.parentId === controlId);
        return [...children, ...children.flatMap(c => getDescendantsPy(c.id, controls))];
    };
    const pythonForms = JSON.parse(JSON.stringify(enabledForms));
    pythonForms.forEach((form: FormState) => {
        const splitContainers = form.controls.filter(c => c.type === 'SplitContainer');
        const idsToDelete = splitContainers.flatMap(sc => [sc.id, ...getDescendantsPy(sc.id, form.controls).map(d => d.id)]);
        form.controls = form.controls.filter(c => !idsToDelete.includes(c.id));
    });


    let needsPlaceholderHelper = false;
    let needsTkCalendar = false;
    pythonForms.forEach(form => {
        if (form.controls.some(c => c.type === 'MaskedTextBox' && c.properties.Placeholder)) needsPlaceholderHelper = true;
        if (form.controls.some(c => c.type === 'DateTimePicker')) needsTkCalendar = true;
    });

    if (needsTkCalendar) {
        script += `# NOTE: This script requires the tkcalendar library.\n# Install it using: pip install tkcalendar\nfrom tkcalendar import DateEntry\n\n`;
    }
    
    if (needsPlaceholderHelper) {
        script += `\n# --- Placeholder Helpers for Entry widgets ---\n`;
        script += `def add_placeholder(widget, placeholder_text, placeholder_color='grey'):
    widget.placeholder = placeholder_text
    widget.placeholder_color = placeholder_color
    widget.default_fg_color = widget['foreground']

    def on_focus_in(event):
        widget = event.widget
        if widget.get() == widget.placeholder:
            widget.delete(0, "end")
            widget.config(foreground=widget.default_fg_color)

    def on_focus_out(event):
        widget = event.widget
        if not widget.get():
            widget.insert(0, widget.placeholder)
            widget.config(foreground=widget.placeholder_color)

    widget.bind("<FocusIn>", on_focus_in)
    widget.bind("<FocusOut>", on_focus_out)
    
    widget.insert(0, widget.placeholder)
    widget.config(foreground=widget.placeholder_color)

`;
    }

    const allEventHandlers: { formId: string, controlName: string, eventName: string, funcName: string, code: string, isLink?: boolean }[] = [];
    pythonForms.forEach(form => {
        form.controls.forEach(control => {
            if (control.type === 'LinkLabel' && control.properties.URL) {
                const funcName = `_on_${control.properties.Name}_link_click`;
                const code = `webbrowser.open_new(r'${control.properties.URL}')`;
                allEventHandlers.push({ formId: form.id, controlName: control.properties.Name, eventName: 'Click', funcName, code, isLink: true });
            }
            if (control.properties.events) {
                Object.entries(control.properties.events).forEach(([eventName, eventCodeObj]) => {
                    const eventCode = (eventCodeObj as { powershell?: string; python?: string; }).python;
                    if (eventCode !== undefined && eventCode !== null) {
                        const funcName = `on_${control.properties.Name}_${eventName}`;
                        allEventHandlers.push({ formId: form.id, controlName: control.properties.Name, eventName, funcName, code: eventCode });
                    }
                });
            }
        });
    });
    
    const generateControlsRecursive = (
        controls: Control[],
        parentId: string | undefined,
        parentWidgetVar: string,
        radioGroups: RadioGroupMap
    ): string => {
        let formScript = '';
        const children = controls.filter(c => c.parentId === parentId);
        const controlTypeMap: { [key in ControlType]?: string } = {
            'Button': 'ttk.Button', 'Label': 'ttk.Label', 'TextBox': 'ttk.Entry', 'RichTextBox': 'tk.Text',
            'GroupBox': 'ttk.LabelFrame', 'ListBox': 'tk.Listbox', 'ComboBox': 'ttk.Combobox',
            'CheckBox': 'ttk.Checkbutton', 'RadioButton': 'ttk.Radiobutton', 'ProgressBar': 'ttk.Progressbar',
            'TrackBar': 'ttk.Scale', 'Panel': 'tk.Frame', 'MaskedTextBox': 'ttk.Entry', 'LinkLabel': 'ttk.Label',
            'DateTimePicker': 'DateEntry'
        };
        const typesWithText = ['Button', 'Label', 'GroupBox', 'CheckBox', 'RadioButton', 'LinkLabel'];

        children.forEach(c => {
            const { Name, Text, Location, Size, Value, Minimum, Maximum, BorderStyle, Placeholder, URL, events } = c.properties;
            const ttk_widget = controlTypeMap[c.type];
            if (!ttk_widget) return;

            formScript += `\n        # Control: ${Name}\n`;
            const widgetVar = `self.${Name}`;
            let constructorArgs = `${parentWidgetVar}`;

            if (Text && typesWithText.includes(c.type)) constructorArgs += `, text="${Text}"`;
            if (c.type === 'CheckBox') constructorArgs += `, variable=self.${Name}_var`;
            if (c.type === 'TextBox' || c.type === 'MaskedTextBox' || c.type === 'ComboBox') constructorArgs += `, textvariable=self.${Name}_var`;
            if (c.type === 'RadioButton') {
                const parentKey = c.parentId || 'root';
                const groupVar = `self.${radioGroups[parentKey].varName}`;
                constructorArgs += `, variable=${groupVar}, value="${Name}"`;
            }
            if (c.type === 'TrackBar') constructorArgs += `, from_=${Minimum || 0}, to=${Maximum || 100}, orient='horizontal', variable=self.${Name}_var`;
            if (c.type === 'Panel') {
                const borderStyleMap: { [key: string]: string } = { 'FixedSingle': 'solid', 'Fixed3D': 'ridge', 'Sunken': 'sunken' };
                const relief = borderStyleMap[BorderStyle as string] || 'flat';
                const borderWidth = relief === 'flat' ? 0 : 1;
                constructorArgs += `, relief='${relief}', borderwidth=${borderWidth}`;
            }
            if (c.type === 'LinkLabel') constructorArgs += `, foreground="blue", cursor="hand2"`;
            if (c.type === 'DateTimePicker') constructorArgs += `, date_pattern='MM/dd/yy'`;

            formScript += `        ${widgetVar} = ${ttk_widget}(${constructorArgs})\n`;

            // Event Binding
            if (URL && c.type === 'LinkLabel') {
                const handler = allEventHandlers.find(h => h.isLink && h.controlName === Name);
                if (handler) formScript += `        ${widgetVar}.bind("<Button-1>", self.${handler.funcName})\n`;
            }
            if (events) {
                const handlerFor = (eventName: string) => allEventHandlers.find(h => !h.isLink && h.controlName === Name && h.eventName === eventName);
                let cmdHandler: any = null;
                if (c.type === 'Button' && handlerFor('Click')) cmdHandler = handlerFor('Click');
                if ((c.type === 'CheckBox' || c.type === 'RadioButton') && handlerFor('CheckedChanged')) cmdHandler = handlerFor('CheckedChanged');
                if (cmdHandler) formScript += `        ${widgetVar}.config(command=self.${cmdHandler.funcName})\n`;
                
                if ((c.type === 'TextBox' || c.type === 'MaskedTextBox' || c.type === 'ComboBox') && handlerFor('TextChanged')) {
                    formScript += `        self.${Name}_var.trace_add("write", lambda *args: self.${handlerFor('TextChanged')!.funcName}())\n`;
                }
                if (c.type === 'ListBox' && handlerFor('SelectedIndexChanged')) {
                    formScript += `        ${widgetVar}.bind("<<ListboxSelect>>", self.${handlerFor('SelectedIndexChanged')!.funcName})\n`;
                }
                if (c.type === 'ComboBox' && handlerFor('SelectedIndexChanged')) {
                    formScript += `        ${widgetVar}.bind("<<ComboboxSelected>>", self.${handlerFor('SelectedIndexChanged')!.funcName})\n`;
                }
            }

            // Post-creation properties
            if (c.type === 'LinkLabel') {
                const fontVar = `self.${Name}_font`;
                formScript += `        ${fontVar} = font.Font(${widgetVar}, ${widgetVar}.cget("font"))\n`;
                formScript += `        ${fontVar}.configure(underline=True)\n`;
                formScript += `        ${widgetVar}.configure(font=${fontVar})\n`;
            }
            if (c.type === 'ProgressBar') {
                if (Minimum !== undefined) formScript += `        ${widgetVar}.config(minimum=${Minimum})\n`;
                if (Maximum !== undefined) formScript += `        ${widgetVar}.config(maximum=${Maximum})\n`;
                if (Value !== undefined) formScript += `        ${widgetVar}['value'] = ${Value}\n`;
            }
            if (c.type === 'RichTextBox' && Text) formScript += `        ${widgetVar}.insert('1.0', """${Text}""")\n`;
            if (c.type === 'MaskedTextBox' && Placeholder) formScript += `        add_placeholder(${widgetVar}, '${Placeholder}')\n`;
            if (c.type === 'MaskedTextBox') formScript += `        # Note: The 'Mask' property for ${Name} requires manual implementation of validation logic.\n`;
            
            formScript += `        ${widgetVar}.place(x=${Location.X}, y=${Location.Y}, width=${Size.Width}, height=${Size.Height})\n`;
            
            if (c.type === 'GroupBox' || c.type === 'Panel') {
                formScript += generateControlsRecursive(controls, c.id, widgetVar, radioGroups);
            }
        });
        return formScript;
    };

    pythonForms.forEach((form, index) => {
        const isMain = index === 0;
        const className = form.properties.Name.charAt(0).toUpperCase() + form.properties.Name.slice(1);
        const baseClass = isMain ? 'tk.Tk' : 'tk.Toplevel';
        const radioGroups = createRadioGroups(form.controls, form.properties.Name);

        script += `\n\n# --- Class for ${form.properties.Name} ---\n`;
        script += `class ${className}(${baseClass}):\n`;
        script += `    def __init__(self, master=None):\n`;
        script += `        super().__init__(master)\n`;
        script += `        self.title("${form.properties.Text}")\n`;
        script += `        self.geometry("${form.properties.Size.Width}x${form.properties.Size.Height}")\n`;
        script += `        self.resizable(False, False)\n`;

        if (isMain) {
            script += `\n        # Center the main window\n`;
            script += `        self.update_idletasks()\n`;
            script += `        screen_width = self.winfo_screenwidth()\n`;
            script += `        screen_height = self.winfo_screenheight()\n`;
            script += `        x_cordinate = int((screen_width/2) - (self.winfo_width()/2))\n`;
            script += `        y_cordinate = int((screen_height/2) - (self.winfo_height()/2))\n`;
            script += `        self.geometry(f"+{x_cordinate}+{y_cordinate}")\n`;
        }
        
        script += `\n        # Declare control variables\n`;
        script += generateTkinterVariables(form.controls, form.properties, radioGroups);

        script += `\n        self.create_widgets()\n`;

        script += `\n    def create_widgets(self):\n`;
        if (form.properties.menu && form.properties.menu.length > 0) {
            script += `        # --- Main Menu ---\n`;
            script += `        menu_bar = tk.Menu(self)\n`;
            script += generatePythonMenuScript(form.properties.menu, 'menu_bar').split('\n').map(l => l ? `        ${l}` : '').join('\n');
            script += `\n        self.config(menu=menu_bar)\n`;
        }
        
        script += generateControlsRecursive(form.controls, undefined, 'self', radioGroups);

        const formEventHandlers = allEventHandlers.filter(h => h.formId === form.id);
        if (formEventHandlers.length > 0) {
            script += `\n    # --- Event Handlers ---\n`;
            formEventHandlers.forEach(handler => {
                script += `    def ${handler.funcName}(self, event=None):\n`;
                if (!handler.isLink) {
                    script += `        # User-defined code for ${handler.controlName}.${handler.eventName}\n`;
                }
                const codeToIndent = handler.code.trim() ? handler.code : 'pass';
                const indentedBody = codeToIndent.split('\n').map(line => `        ${line}`).join('\n');
                script += `${indentedBody}\n\n`;
            });
        }
    });

    if (pythonForms.length > 0) {
      const mainForm = pythonForms[0];
      const mainClassName = mainForm.properties.Name.charAt(0).toUpperCase() + mainForm.properties.Name.slice(1);
      script += `\n\nif __name__ == "__main__":\n`;
      script += `    app = ${mainClassName}()\n`;
      pythonForms.slice(1).forEach(form => {
          const className = form.properties.Name.charAt(0).toUpperCase() + form.properties.Name.slice(1);
          script += `    ${form.properties.Name}_window = ${className}(app)\n`;
      });
      script += `    app.mainloop()\n`;
    }
    return script;
};

// --- UTILITY FUNCTIONS ---
const isColliding = (rectA: { x: number, y: number, w: number, h: number }, rectB: { x: number, y: number, w: number, h: number }): boolean => {
    return rectA.x < rectB.x + rectB.w &&
           rectA.x + rectA.w > rectB.x &&
           rectA.y < rectB.y + rectB.h &&
           rectA.h + rectA.y > rectB.y;
}

const CONTROL_EVENTS: { [key in ControlType]?: string[] } = {
  Button: ['Click'],
  TextBox: ['TextChanged'],
  MaskedTextBox: ['TextChanged'],
  ListBox: ['SelectedIndexChanged'],
  ComboBox: ['SelectedIndexChanged', 'TextChanged'],
  CheckBox: ['CheckedChanged'],
  RadioButton: ['CheckedChanged'],
  LinkLabel: ['LinkClicked'],
};

// --- INITIAL STATE ---
const initialForms: FormState[] = [
  {
    id: 'form_0',
    isEnabled: true,
    properties: { Name: 'mainForm', Text: 'CyberForm', Location: { X: 150, Y: 100 }, Size: { Width: 480, Height: 320 }, menu: [] },
    controls: [
      { id: 'btn_about', type: 'Button', properties: { Name: 'aboutButton', Text: 'About', Location: { X: 10, Y: 10 }, Size: { Width: 80, Height: 30 }, 
          events: { 
              Click: { 
                  powershell: `[System.Windows.Forms.MessageBox]::Show('Button Clicked!')`,
                  python: `messagebox.showinfo('Info', 'Button Clicked!')`
              } 
          } 
      } },
    ]
  },
  {
    id: 'form_1',
    isEnabled: false,
    properties: { Name: 'form2', Text: 'Second Form', Location: { X: 0, Y: 0 }, Size: { Width: 300, Height: 200 }, menu: [] },
    controls: []
  },
  {
    id: 'form_2',
    isEnabled: false,
    properties: { Name: 'form3', Text: 'Third Form', Location: { X: 0, Y: 0 }, Size: { Width: 300, Height: 200 }, menu: [] },
    controls: []
  }
];

// --- APP COMPONENT ---
const App = () => {
  const [forms, setForms] = useState<FormState[]>(initialForms);
  const [currentFormIndex, setCurrentFormIndex] = useState(0);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'properties' | 'events' | 'menu' | 'code'>('properties');
  const [pointerPos, setPointerPos] = useState({ x: 0, y: 0 });
  const [isPointerInForm, setIsPointerInForm] = useState(false);
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const [generatedCode, setGeneratedCode] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [enhancementPrompt, setEnhancementPrompt] = useState<string>('');
  const [targetLanguage, setTargetLanguage] = useState<'powershell' | 'python'>('powershell');
  const [panelHeight, setPanelHeight] = useState(250);
  const [isGridVisible, setIsGridVisible] = useState(false);
  const [isSnapToGridEnabled, setIsSnapToGridEnabled] = useState(false);
  const [isFormLocked, setIsFormLocked] = useState(true);
  const [clipboard, setClipboard] = useState<Control[] | null>(null);
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0 });
  // FIX: Removed state related to API key management UI.
  const [windowSize, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [copyStatus, setCopyStatus] = useState('Copy');
  const [potentialParentId, setPotentialParentId] = useState<string | null>(null);
  const [propErrors, setPropErrors] = useState<Record<string, string>>({});
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  const GRID_SIZE = 10;
  
  type DragState = {
    mode: 'move' | 'resize';
    draggedItemId: string; // The specific item the pointer is on
    startPointer: { x: number; y: number };
    items: Array<{
      id: string;
      startPos: { X: number; Y: number };
      startSize: { Width: number; Height: number };
    }>;
    isColliding: boolean;
  };
  const dragState = useRef<DragState | null>(null);
  const splitterDragState = useRef<{
    isResizing: boolean;
    controlId: string;
    startPointer: { x: number; y: number };
    startDistance: number;
  } | null>(null);
  const panelResizeDragState = useRef<{ isResizing: boolean; startY: number; startHeight: number; } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const currentForm = forms[currentFormIndex];
  const selectedItem = currentForm.controls.find(c => c.id === selectedItemIds[0]); // For single-prop display
  const isFormSelected = selectedItemIds.length === 1 && selectedItemIds[0].startsWith('form_');
  const isSingleControlSelected = selectedItemIds.length === 1 && !isFormSelected;

  // --- HIERARCHY HELPERS ---
  const getDescendants = useCallback((controlId: string, controls: Control[]): Control[] => {
    const children = controls.filter(c => c.parentId === controlId);
    return [...children, ...children.flatMap(c => getDescendants(c.id, controls))];
  }, []);

  const getAbsoluteControlPosition = useCallback((controlId: string, controls: Control[]): { X: number, Y: number } => {
    const control = controls.find(c => c.id === controlId);
    if (!control) return { X: 0, Y: 0 };
    
    if (!control.parentId) return control.properties.Location; // Top-level control
    
    const parent = controls.find(c => c.id === control.parentId);
    if (!parent) return control.properties.Location; // Orphaned
    
    const parentAbsPos = getAbsoluteControlPosition(parent.id, controls);
    
    let panelOffsetX = 0;
    let panelOffsetY = 0;

    if (parent.type === 'SplitContainer' && control.splitterPanel === 2) {
        if (parent.properties.Orientation === 'Vertical') {
            panelOffsetX = parent.properties.SplitterDistance || 0;
        } else { // Horizontal
            panelOffsetY = parent.properties.SplitterDistance || 0;
        }
    }
    
    return {
        X: parentAbsPos.X + panelOffsetX + control.properties.Location.X,
        Y: parentAbsPos.Y + panelOffsetY + control.properties.Location.Y,
    };
  }, []);

  // --- Effects ---
  useEffect(() => {
    const handleResize = () => {
        setWindowSize({ width: window.innerWidth, height: window.innerHeight });
        if (window.innerWidth > 1024) {
          setIsSidebarOpen(false); // Close sidebar on resize to desktop
        }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useLayoutEffect(() => {
    if (canvasRef.current && isFormLocked) {
      const canvasRect = canvasRef.current.getBoundingClientRect();
      // Prevent centering if canvas has no dimensions, which can happen on initial load in a hidden tab.
      if (canvasRect.width === 0 || canvasRect.height === 0) return;

      const formProps = forms[currentFormIndex].properties;
      const newX = (canvasRect.width - formProps.Size.Width) / 2;
      const newY = (canvasRect.height - formProps.Size.Height) / 2;
      
      // Only update if the position is significantly different to prevent render loops.
      if (Math.abs(formProps.Location.X - newX) > 1 || Math.abs(formProps.Location.Y - newY) > 1) {
        updateFormProperty(currentFormIndex, 'Location', { X: newX, Y: newY });
      }
    }
  }, [currentFormIndex, forms[currentFormIndex].properties.Size, isFormLocked, windowSize]);
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA' || (e.target as HTMLElement).tagName === 'SELECT') {
            return;
        }

        const isCtrl = e.ctrlKey || e.metaKey;

        if (isCtrl && e.key.toLowerCase() === 'c') {
            handleCopy();
        } else if (isCtrl && e.key.toLowerCase() === 'v') {
            handlePaste();
        } else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
            e.preventDefault();
            handleArrowKeyMove(e.key, e.shiftKey);
        } else if (e.key === 'Delete' || e.key === 'Backspace') {
            deleteSelectedItems();
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedItemIds, currentFormIndex, forms, getDescendants]);
  
  useEffect(() => {
    const handlePointerDown = () => setContextMenu(c => ({ ...c, visible: false }));
    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, []);
  
  useEffect(() => {
    setPropErrors({});
  }, [selectedItemIds]);


  // --- State Updaters ---
  const updateControlProperties = (ids: string[], newProps: Partial<ControlProperties> | ((prev: ControlProperties) => Partial<ControlProperties>)) => {
    setForms(prevForms => prevForms.map(form => ({
        ...form,
        controls: form.controls.map(c => {
            if (ids.includes(c.id)) {
                const finalProps = typeof newProps === 'function' ? newProps(c.properties) : newProps;
                return { ...c, properties: { ...c.properties, ...finalProps } };
            }
            return c;
        })
    })));
  };

  const updateFormProperty = (formIndex: number, propName: keyof FormProperties, value: any) => {
      setForms(prevForms => {
        const newForms = [...prevForms];
        const currentForm = newForms[formIndex];
        newForms[formIndex] = {
          ...currentForm,
          properties: {
            ...currentForm.properties,
            [propName]: value
          }
        };
        return newForms;
      });
  };
  
  const handleEventCodeChange = (controlId: string, eventName: string, code: string) => {
      updateControlProperties([controlId], prev => ({
          events: {
              ...prev.events,
              [eventName]: {
                  ...(prev.events?.[eventName] || {}),
                  [targetLanguage]: code,
              }
          }
      }));
  };
  
  // --- Pointer & Drag Handlers ---
  // FIX: Changed event type from React.PointerEvent to React.MouseEvent to match onContextMenu handler signature.
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ visible: true, x: e.clientX, y: e.clientY });
  };
  
  const handlePointerMoveOnCanvas = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!canvasRef.current || dragState.current || splitterDragState.current || panelResizeDragState.current) return;
    const canvasRect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - canvasRect.left;
    const y = e.clientY - canvasRect.top;
    const formX = x - currentForm.properties.Location.X;
    const formY = y - currentForm.properties.Location.Y;

    setPointerPos({ x: formX, y: formY });
    setIsPointerInForm(formX >= 0 && formX <= currentForm.properties.Size.Width && formY >= 0 && formY <= currentForm.properties.Size.Height);
  };
  
  const handleDragMove = useCallback((e: PointerEvent) => {
    if (!canvasRef.current) return;
    const canvasRect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - canvasRect.left;
    const y = e.clientY - canvasRect.top;
    const formX = x - currentForm.properties.Location.X;
    const formY = y - currentForm.properties.Location.Y;
    
    setPointerPos({ x: formX, y: formY });

    if (splitterDragState.current) {
      const control = currentForm.controls.find(c => c.id === splitterDragState.current!.controlId);
      if (control) {
          const dx = e.clientX - splitterDragState.current.startPointer.x;
          const dy = e.clientY - splitterDragState.current.startPointer.y;
          const change = control.properties.Orientation === 'Vertical' ? dx : dy;
          const newDistance = splitterDragState.current.startDistance + change;
          const max = control.properties.Orientation === 'Vertical' ? control.properties.Size.Width : control.properties.Size.Height;
          const finalDistance = Math.max(20, Math.min(newDistance, max - 20));
          updateControlProperties([control.id], { SplitterDistance: finalDistance });
      }
      return;
    }

    if (dragState.current) {
        const dx = x - dragState.current.startPointer.x;
        const dy = y - dragState.current.startPointer.y;
        
        const isFormDrag = dragState.current.draggedItemId.startsWith('form_');

        if (isFormDrag) {
            const formItem = dragState.current.items[0];
            const formIndex = forms.findIndex(f => f.id === formItem.id);
            if (formIndex > -1) {
                const newX = formItem.startPos.X + dx;
                const newY = formItem.startPos.Y + dy;
                updateFormProperty(formIndex, 'Location', { X: newX, Y: newY });
            }
        } else {
            let isCurrentlyColliding = false;
            const draggedIds = dragState.current.items.map(i => i.id);

            dragState.current.items.forEach(draggedItem => {
                const control = currentForm.controls.find(c => c.id === draggedItem.id);
                if (!control) return;

                if (control.parentId && draggedIds.includes(control.parentId)) {
                    return; // Movement is handled by parent
                }

                let newProps: Partial<ControlProperties> = {};
                if (dragState.current!.mode === 'move') {
                    let newX = draggedItem.startPos.X + dx;
                    let newY = draggedItem.startPos.Y + dy;
                    if (isSnapToGridEnabled) {
                        newX = Math.round(newX / GRID_SIZE) * GRID_SIZE;
                        newY = Math.round(newY / GRID_SIZE) * GRID_SIZE;
                    }
                    newProps.Location = { X: newX, Y: newY };
                } else { // resize
                    let newWidth = draggedItem.startSize.Width + dx;
                    let newHeight = draggedItem.startSize.Height + dy;
                    if (isSnapToGridEnabled) {
                        newWidth = Math.round(newWidth / GRID_SIZE) * GRID_SIZE;
                        newHeight = Math.round(newHeight / GRID_SIZE) * GRID_SIZE;
                    }
                    newProps.Size = { Width: Math.max(20, newWidth), Height: Math.max(20, newHeight) };
                }
                
                // Collision Detection
                const otherControls = currentForm.controls.filter(c => !draggedIds.includes(c.id));
                const currentRect = { 
                    x: newProps.Location?.X ?? draggedItem.startPos.X, 
                    y: newProps.Location?.Y ?? draggedItem.startPos.Y, 
                    w: newProps.Size?.Width ?? draggedItem.startSize.Width, 
                    h: newProps.Size?.Height ?? draggedItem.startSize.Height
                };
                if(control.parentId){
                    const parentAbsPos = getAbsoluteControlPosition(control.parentId, currentForm.controls);
                    currentRect.x += parentAbsPos.X;
                    currentRect.y += parentAbsPos.Y;
                }
                for (const other of otherControls) {
                    const otherAbsPos = getAbsoluteControlPosition(other.id, currentForm.controls);
                    const otherRect = { x: otherAbsPos.X, y: otherAbsPos.Y, w: other.properties.Size.Width, h: other.properties.Size.Height };
                    if(isColliding(currentRect, otherRect)) {
                        isCurrentlyColliding = true;
                        break;
                    }
                }
                
                updateControlProperties([draggedItem.id], newProps);
            });
            
            // Visual feedback for reparenting
            const potentialParents = currentForm.controls.filter(p => (p.type === 'GroupBox' || p.type === 'Panel' || p.type === 'SplitContainer') && !draggedIds.includes(p.id));
            let newPotentialParent: string | null = null;
            for (const p of potentialParents) {
                const pAbsPos = getAbsoluteControlPosition(p.id, currentForm.controls);
                const pRect = { x: pAbsPos.X, y: pAbsPos.Y, w: p.properties.Size.Width, h: p.properties.Size.Height };
                if (formX > pRect.x && formX < pRect.x + pRect.w && formY > pRect.y && formY < pRect.y + pRect.h) {
                    newPotentialParent = p.id;
                    break;
                }
            }
            setPotentialParentId(newPotentialParent);
            dragState.current.isColliding = isCurrentlyColliding;
        }
    }
  }, [forms, currentFormIndex, isSnapToGridEnabled, getAbsoluteControlPosition]);

  const handleDragEnd = useCallback((e: PointerEvent) => {
    if (dragState.current) {
        setPotentialParentId(null);
        // Capture the ref's value in a local variable.
        const currentDragState = dragState.current;
        const isFormDrag = currentDragState.draggedItemId.startsWith('form_');
        
        if (!isFormDrag) { // Only do collision/reparenting for controls
            if (currentDragState.isColliding) {
                // Revert to start positions
                currentDragState.items.forEach(item => {
                    updateControlProperties([item.id], { Location: item.startPos, Size: item.startSize });
                });
            } else if (currentDragState.mode === 'move') {
                // Handle reparenting
                setForms(prevForms => {
                    const newForms = [...prevForms];
                    const formToUpdate = { ...newForms[currentFormIndex] };
                    const controls = [...formToUpdate.controls];
                    
                    const draggedIds = currentDragState.items.map(i => i.id);
                    const primarilyDragged = currentDragState.items.filter(item => {
                        const c = controls.find(ctrl => ctrl.id === item.id);
                        return !c?.parentId || !draggedIds.includes(c.parentId);
                    });

                    primarilyDragged.forEach(item => {
                        const control = controls.find(c => c.id === item.id)!;
                        const finalAbsPos = getAbsoluteControlPosition(item.id, controls);
                        
                        const potentialParents = controls.filter(p => (p.type === 'GroupBox' || p.type === 'Panel' || p.type === 'SplitContainer') && !draggedIds.includes(p.id));
                        let newParent: Control | null = null;
                        let newSplitterPanel: 1 | 2 | undefined = undefined;
                        
                        for (const p of potentialParents) {
                            const pAbsPos = getAbsoluteControlPosition(p.id, controls);
                            const pRect = { x: pAbsPos.X, y: pAbsPos.Y, w: p.properties.Size.Width, h: p.properties.Size.Height };
                            if (finalAbsPos.X > pRect.x && finalAbsPos.X < pRect.x + pRect.w && finalAbsPos.Y > pRect.y && finalAbsPos.Y < pRect.y + pRect.h) {
                                newParent = p;
                                if (p.type === 'SplitContainer') {
                                    const splitterPos = p.properties.SplitterDistance || 0;
                                    if (p.properties.Orientation === 'Vertical') {
                                        newSplitterPanel = (finalAbsPos.X - pAbsPos.X) < splitterPos ? 1 : 2;
                                    } else { // Horizontal
                                        newSplitterPanel = (finalAbsPos.Y - pAbsPos.Y) < splitterPos ? 1 : 2;
                                    }
                                }
                                break;
                            }
                        }

                        const ctrlIndex = controls.findIndex(c => c.id === item.id);
                        if (newParent && (control.parentId !== newParent.id || control.splitterPanel !== newSplitterPanel)) {
                            const pAbsPos = getAbsoluteControlPosition(newParent.id, controls);
                            let panelOffsetX = 0;
                            let panelOffsetY = 0;
                            if (newParent.type === 'SplitContainer' && newSplitterPanel === 2) {
                                if (newParent.properties.Orientation === 'Vertical') {
                                    panelOffsetX = newParent.properties.SplitterDistance || 0;
                                } else {
                                    panelOffsetY = newParent.properties.SplitterDistance || 0;
                                }
                            }
                            
                            const updatedControl: Control = {
                                ...control,
                                parentId: newParent.id,
                                splitterPanel: newSplitterPanel,
                                properties: {
                                    ...control.properties,
                                    Location: { X: finalAbsPos.X - (pAbsPos.X + panelOffsetX), Y: finalAbsPos.Y - (pAbsPos.Y + panelOffsetY) }
                                }
                            };
                            controls[ctrlIndex] = updatedControl;
                        } else if (!newParent && (control.parentId || control.splitterPanel)) {
                            controls[ctrlIndex] = { ...control, parentId: undefined, splitterPanel: undefined, properties: { ...control.properties, Location: finalAbsPos } };
                        }
                    });

                    formToUpdate.controls = controls;
                    newForms[currentFormIndex] = formToUpdate;
                    return newForms;
                });
            }
        }
        
        if (canvasRef.current) {
            const canvasRect = canvasRef.current.getBoundingClientRect();
            addRipple(e.clientX - canvasRect.left, e.clientY - canvasRect.top, 'ripple');
        }
    }
    
    // Universal cleanup for all drag types
    dragState.current = null;
    splitterDragState.current = null;
    window.removeEventListener('pointermove', handleDragMove);
    window.removeEventListener('pointerup', handleDragEnd);
    window.removeEventListener('pointercancel', handleDragEnd);
  }, [forms, currentFormIndex, getAbsoluteControlPosition]);
  
  const handlePointerDown = (e: React.PointerEvent, id: string, mode: 'move' | 'resize') => {
    e.stopPropagation();
    if (contextMenu.visible) {
      setContextMenu({ ...contextMenu, visible: false });
    }
    if (!canvasRef.current) return;
    
    const isForm = id.startsWith('form_');
    const isCtrl = e.ctrlKey || e.metaKey;
    let newSelectedIds: string[];

    if (isForm) {
        if (isFormLocked) return;
        newSelectedIds = [id];
    } else if (isCtrl) {
        newSelectedIds = selectedItemIds.includes(id) 
            ? selectedItemIds.filter(sid => sid !== id)
            : [...selectedItemIds, id];
    } else {
        newSelectedIds = selectedItemIds.includes(id) ? selectedItemIds : [id];
    }
    
    setSelectedItemIds(newSelectedIds);
    if (!isForm) setActiveTab('properties');

    const canvasRect = canvasRef.current.getBoundingClientRect();
    const canvasPointerX = e.clientX - canvasRect.left;
    const canvasPointerY = e.clientY - canvasRect.top;
    addRipple(canvasPointerX, canvasPointerY, 'wormhole');
    
    if (isForm) {
        const form = forms.find(f => f.id === id);
        if (!form) return;
        dragState.current = {
            mode: 'move',
            draggedItemId: id,
            startPointer: { x: canvasPointerX, y: canvasPointerY },
            isColliding: false,
            items: [{ id: form.id, startPos: { ...form.properties.Location }, startSize: { ...form.properties.Size } }]
        };
    } else {
        const itemsToDrag = currentForm.controls.filter(c => newSelectedIds.includes(c.id));
        const descendants = itemsToDrag.flatMap(c => getDescendants(c.id, currentForm.controls));
        const allItems = [...new Set([...itemsToDrag, ...descendants])];
        
        dragState.current = {
            mode,
            draggedItemId: id,
            startPointer: { x: canvasPointerX, y: canvasPointerY },
            isColliding: false,
            items: allItems.map(c => ({ id: c.id, startPos: { ...c.properties.Location }, startSize: { ...c.properties.Size } }))
        };
    }

    window.addEventListener('pointermove', handleDragMove);
    window.addEventListener('pointerup', handleDragEnd);
    window.addEventListener('pointercancel', handleDragEnd);
  };

  const handleSplitterPointerDown = (e: React.PointerEvent, id: string) => {
    e.stopPropagation();
    const control = currentForm.controls.find(c => c.id === id);
    if (!control || !canvasRef.current) return;

    splitterDragState.current = {
        isResizing: true,
        controlId: id,
        startPointer: { x: e.clientX, y: e.clientY },
        startDistance: control.properties.SplitterDistance || 0,
    };

    window.addEventListener('pointermove', handleDragMove);
    window.addEventListener('pointerup', handleDragEnd);
    window.addEventListener('pointercancel', handleDragEnd);
  };
  
  // --- Keyboard & Clipboard ---
  const handleArrowKeyMove = (key: string, isShift: boolean) => {
    if (selectedItemIds.length === 0) return;
    const amount = isShift ? GRID_SIZE : 1;
    let dx = 0, dy = 0;
    if (key === 'ArrowLeft') dx = -amount;
    if (key === 'ArrowRight') dx = amount;
    if (key === 'ArrowUp') dy = -amount;
    if (key === 'ArrowDown') dy = amount;

    updateControlProperties(selectedItemIds, (prev) => ({
        Location: { X: prev.Location.X + dx, Y: prev.Location.Y + dy }
    }));
  };

  const handleCopy = () => {
    if (selectedItemIds.length > 0) {
        const controlsToCopy = currentForm.controls.filter(c => selectedItemIds.includes(c.id));
        const descendants = controlsToCopy.flatMap(c => getDescendants(c.id, currentForm.controls));
        setClipboard([...controlsToCopy, ...descendants]);
    }
  };

  const handlePaste = () => {
    if (!clipboard) return;
    const allControlNames = forms.flatMap(f => f.controls.map(c => c.properties.Name));
    
    const idMap = new Map<string, string>();
    const newControls = clipboard.map(controlToPaste => {
        let newName = `${controlToPaste.properties.Name}_copy`;
        let copyIndex = 1;
        while(allControlNames.includes(newName)) {
            newName = `${controlToPaste.properties.Name}_copy${copyIndex++}`;
        }
        const newId = `ctrl_${Date.now()}_${Math.random()}`;
        idMap.set(controlToPaste.id, newId);

        return {
            ...controlToPaste,
            id: newId,
            properties: {
                ...controlToPaste.properties,
                Name: newName,
                Location: {
                    X: controlToPaste.properties.Location.X + GRID_SIZE,
                    Y: controlToPaste.properties.Location.Y + GRID_SIZE
                }
            }
        };
    });

    newControls.forEach(c => {
        if (c.parentId && idMap.has(c.parentId)) {
            c.parentId = idMap.get(c.parentId);
        }
    });

    setForms(forms.map((form, index) => 
        index === currentFormIndex 
            ? { ...form, controls: [...form.controls, ...newControls] }
            : form
    ));
    setSelectedItemIds(newControls.filter(c => !c.parentId || !idMap.has(c.parentId)).map(c => c.id));
  };
  
  // --- Control & Form Management ---
  const addControl = (type: ControlType) => {
      const controlCount = forms.reduce((acc, f) => acc + f.controls.length, 0);
      let parentId: string | undefined = undefined;
      let splitterPanel: 1 | 2 | undefined = undefined;
      // Default to center of form
      let location = { X: Math.round(currentForm.properties.Size.Width / 2 - 50), Y: Math.round(currentForm.properties.Size.Height / 2 - 15) };
      
      if (isSingleControlSelected && selectedItem && ['GroupBox', 'Panel', 'SplitContainer'].includes(selectedItem.type)) {
        parentId = selectedItem.id;
        location = { X: 10, Y: 20 };
        if (selectedItem.type === 'SplitContainer') {
            splitterPanel = 1; // Default to panel 1
        }
      }

      const baseProperties = {
            Name: `${type.toLowerCase().replace(/\s/g, '')}${controlCount + 1}`,
            Text: type,
            Location: location,
      };

      let specificProperties: Partial<ControlProperties> = {};
      switch(type) {
        case 'TextBox':
            specificProperties = { Size: { Width: 100, Height: 24 } };
            break;
        case 'MaskedTextBox':
             specificProperties = { Text: '', Size: { Width: 150, Height: 24 }, Placeholder: '(___) ___-____', Mask: '(999) 000-0000' };
            break;
        case 'RichTextBox':
            specificProperties = { Text: 'Rich Text...', Size: { Width: 200, Height: 100 } };
            break;
        case 'CheckBox':
        case 'RadioButton':
            specificProperties = { Size: { Width: 120, Height: 24 }, Checked: false };
            break;
        case 'ProgressBar':
             specificProperties = { Text: '', Size: { Width: 150, Height: 24 }, Value: 25, Minimum: 0, Maximum: 100 };
            break;
        case 'TrackBar':
             specificProperties = { Text: '', Size: { Width: 150, Height: 24 }, Value: 50, Minimum: 0, Maximum: 100 };
            break;
        case 'Panel':
            specificProperties = { Text: '', Size: { Width: 200, Height: 150 }, BorderStyle: 'FixedSingle' };
            break;
        case 'SplitContainer':
            specificProperties = { Text: '', Size: { Width: 400, Height: 250 }, Orientation: 'Vertical', SplitterDistance: 150 };
            break;
        case 'LinkLabel':
            specificProperties = { Text: 'Click Here', Size: { Width: 120, Height: 24 }, URL: 'https://example.com' };
            break;
        case 'DateTimePicker':
            specificProperties = { Text: '', Size: { Width: 150, Height: 24 }, Format: 'Short' };
            break;
        default:
             specificProperties = { Size: { Width: 100, Height: 30 } };
            break;
      }

      const newControl: Control = {
          id: `ctrl_${Date.now()}`,
          type,
          parentId,
          splitterPanel,
          properties: { ...baseProperties, ...specificProperties } as ControlProperties
      };
      setForms(forms.map((form, index) => 
          index === currentFormIndex 
              ? { ...form, controls: [...form.controls, newControl] }
              : form
      ));
      setSelectedItemIds([newControl.id]);
  };

  const deleteSelectedItems = () => {
    if (selectedItemIds.length === 0 || isFormSelected) return;
    const allDescendants = selectedItemIds.flatMap(id => getDescendants(id, currentForm.controls).map(c => c.id));
    const idsToDelete = [...new Set([...selectedItemIds, ...allDescendants])];

    setForms(forms.map(form => ({
        ...form,
        controls: form.controls.filter(c => !idsToDelete.includes(c.id))
    })));
    setSelectedItemIds([currentForm.id]);
  };
  
  const handlePropChange = (id: string, propName: string, value: any) => {
    if (id.startsWith('form_')) {
        const formIndex = forms.findIndex(f => f.id === id);
        updateFormProperty(formIndex, propName as keyof FormProperties, value);
    } else {
        updateControlProperties([id], { [propName]: value });
    }
  };

  const addRipple = (x: number, y: number, type: Ripple['type']) => {
    const newRipple: Ripple = { id: Date.now(), x, y, type };
    setRipples(r => [...r, newRipple]);
    setTimeout(() => setRipples(r => r.filter(rip => rip.id !== newRipple.id)), 700);
  };

  // --- Code Generation ---
  const handleGenerateCode = async () => {
    setError(null);
    setIsGenerating(true);
    setGeneratedCode('');
    try {
        const code = targetLanguage === 'powershell' 
            ? generateLocalPowerShellCode(forms) 
            : generateLocalPythonCode(forms);
        setGeneratedCode(code);
    } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred during code generation.');
    } finally {
        setIsGenerating(false);
    }
  };
  
  const handleCopyCode = () => {
    if (!generatedCode) return;
    navigator.clipboard.writeText(generatedCode).then(() => {
        setCopyStatus('Copied!');
        setTimeout(() => setCopyStatus('Copy'), 2000);
    }).catch(err => {
        console.error('Failed to copy code: ', err);
        setCopyStatus('Error!');
        setTimeout(() => setCopyStatus('Copy'), 2000);
    });
  };

  const handleSaveCode = () => {
    if (!generatedCode) return;
    
    const extension = targetLanguage === 'powershell' ? 'ps1' : 'py';
    const defaultFileName = `gui_script.${extension}`;
    
    const blob = new Blob([generatedCode], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = defaultFileName;
    document.body.appendChild(a);
    a.click();
    
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };


  const handleEnhanceCode = async () => {
      if (!generatedCode || !enhancementPrompt) return;
      setError(null);
      setIsGenerating(true);
      try {
          // FIX: API key is now handled by geminiService via environment variables.
          const prompt = `Base Code:\n\`\`\`${targetLanguage}\n${generatedCode}\n\`\`\`\n\nUser Request: ${enhancementPrompt}`;
          const enhancedCode = await enhanceCodeWithAI(prompt, targetLanguage);
          setGeneratedCode(enhancedCode);
      } catch (err) {
          setError(err instanceof Error ? err.message : 'An unknown AI error occurred.');
      } finally {
          setIsGenerating(false);
      }
  };
  
  // --- Form & Menu Management ---
  const handleToggleForm = (formId: string) => {
    setForms(forms.map(f => f.id === formId ? { ...f, isEnabled: !f.isEnabled } : f));
  };
  
  const addMenuItem = (path: string[]) => {
    const newMenuItem: MenuItem = { id: `menu_${Date.now()}`, text: 'NewItem', name: `newItem${Date.now()}` };
    const addRecursive = (items: MenuItem[], currentPath: string[]): MenuItem[] => {
      if (currentPath.length === 0) return [...items, newMenuItem];
      const [head, ...tail] = currentPath;
      return items.map(item => (item.id === head) ? { ...item, items: addRecursive(item.items || [], tail) } : item);
    };
    updateFormProperty(currentFormIndex, 'menu', addRecursive(currentForm.properties.menu || [], path));
  };

  const removeMenuItem = (path: string[]) => {
    if (path.length === 0) return;
    const removeRecursive = (items: MenuItem[], currentPath: string[]): MenuItem[] => {
      if (currentPath.length === 0) return items;
      const [head, ...tail] = currentPath;
      if (tail.length === 0) return items.filter(item => item.id !== head);
      return items.map(item => (item.id === head) ? { ...item, items: removeRecursive(item.items || [], tail) } : item);
    };
    updateFormProperty(currentFormIndex, 'menu', removeRecursive(currentForm.properties.menu || [], path));
  };

  const updateMenuItem = (path: string[], newText: string) => {
    const updateRecursive = (items: MenuItem[], currentPath: string[]): MenuItem[] => {
      if (currentPath.length === 0) return items;
      const [head, ...tail] = currentPath;
      return items.map(item => {
        if (item.id === head) {
          if (tail.length === 0) return { ...item, text: newText, name: newText.replace(/\s+/g, '') };
          return { ...item, items: updateRecursive(item.items || [], tail) };
        }
        return item;
      });
    };
    updateFormProperty(currentFormIndex, 'menu', updateRecursive(currentForm.properties.menu || [], path));
  };

  // --- Panel Resizing ---
  const handlePanelResizePointerMove = useCallback((e: PointerEvent) => {
      if (!panelResizeDragState.current?.isResizing) return;
      const dy = e.clientY - panelResizeDragState.current.startY;
      const newHeight = panelResizeDragState.current.startHeight - dy;
      const minHeight = 150;
      const maxHeight = window.innerHeight - 200;
      setPanelHeight(Math.max(minHeight, Math.min(newHeight, maxHeight)));
  }, []);

  const handlePanelResizePointerUp = useCallback(() => {
      panelResizeDragState.current = null;
      window.removeEventListener('pointermove', handlePanelResizePointerMove);
      window.removeEventListener('pointerup', handlePanelResizePointerUp);
      window.removeEventListener('pointercancel', handlePanelResizePointerUp);
  }, [handlePanelResizePointerMove]);

  const handlePanelResizePointerDown = (e: React.PointerEvent) => {
      e.preventDefault();
      panelResizeDragState.current = { isResizing: true, startY: e.clientY, startHeight: panelHeight };
      window.addEventListener('pointermove', handlePanelResizePointerMove);
      window.addEventListener('pointerup', handlePanelResizePointerUp);
      window.addEventListener('pointercancel', handlePanelResizePointerUp);
  };
  
  // FIX: Removed API key management functions (handleExportKeyTemplate, handleImportKeys)
  
  // --- RENDER ---
  const renderProperties = () => {
    if (selectedItemIds.length === 0) return <p>Select an item to see its properties.</p>;

    if (selectedItemIds.length > 1) {
        const selectedControls = currentForm.controls.filter(c => selectedItemIds.includes(c.id));
        const first = selectedControls[0];
        if (!first) return <p>{selectedItemIds.length} items selected.</p>;

        const sameWidth = selectedControls.every(c => c.properties.Size.Width === first.properties.Size.Width);
        const sameHeight = selectedControls.every(c => c.properties.Size.Height === first.properties.Size.Height);

        const handleMultiPropChange = (prop: string, value: string) => {
            const numValue = parseInt(value, 10);
            if (isNaN(numValue)) return; // Ignore invalid input

            const [propName, subProp] = prop.split('.');
            updateControlProperties(selectedItemIds, prev => ({
                [propName]: { ...(prev[propName] as object), [subProp]: numValue }
            }));
        };

        return (
            <div className="properties-grid">
                <div className="prop-group-title" style={{gridColumn: '1 / -1'}}>{selectedItemIds.length} ITEMS SELECTED</div>
                <div className="prop-group-title">COMMON LAYOUT</div>
                <div className="prop-group">
                    <label htmlFor="prop-size-w">WIDTH</label>
                    <input id="prop-size-w" name="Size.Width" type="number" 
                        value={sameWidth ? first.properties.Size.Width : ''}
                        placeholder={sameWidth ? '' : 'Multiple Values'}
                        onChange={e => handleMultiPropChange(e.target.name, e.target.value)}
                        className="property-input" />
                </div>
                <div className="prop-group">
                    <label htmlFor="prop-size-h">HEIGHT</label>
                    <input id="prop-size-h" name="Size.Height" type="number"
                        value={sameHeight ? first.properties.Size.Height : ''}
                        placeholder={sameHeight ? '' : 'Multiple Values'}
                        onChange={e => handleMultiPropChange(e.target.name, e.target.value)}
                        className="property-input" />
                </div>
            </div>
        );
    }

    const selectedId = selectedItemIds[0];
    const item = forms.find(f => f.id === selectedId) || currentForm.controls.find(c => c.id === selectedId);
    if (!item) return <p>Select an item to see its properties.</p>;
    
    const isControl = 'type' in item;
    const props = item.properties as ControlProperties | FormProperties;
    const control = item as Control;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const { name, value, type } = e.target;
      let finalValue: string | boolean = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;

      if (name === 'Name') {
        if (typeof finalValue === 'string') {
          const saneValue = finalValue.replace(/[^a-zA-Z0-9_]/g, '');
          const originalName = props.Name;

          // Immediately update the property so the input field reflects the sanitized value
          handlePropChange(item.id, name, saneValue);

          if (saneValue.length === 0) {
              setPropErrors(e => ({ ...e, Name: 'Name cannot be empty.' }));
              return;
          }
          if (!/^[a-zA-Z_]/.test(saneValue)) {
            setPropErrors(e => ({ ...e, Name: 'Must start with a letter or underscore.' }));
            return;
          }
          
          const isDuplicate = saneValue.toLowerCase() !== originalName.toLowerCase() && forms.flatMap(f => [
              f.properties.Name.toLowerCase(), 
              ...f.controls.map(c => c.properties.Name.toLowerCase())
          ]).includes(saneValue.toLowerCase());

          if (isDuplicate) {
              setPropErrors(e => ({ ...e, Name: 'Name is already in use.' }));
              return;
          }
          
          // If all checks pass, clear the error
          setPropErrors(e => {
            const newErrors = { ...e };
            delete newErrors.Name;
            return newErrors;
          });
        }
      } else if (name.includes('.')) {
        const [prop, subProp] = name.split('.');
        const numValue = parseInt(value, 10);
        if (!isNaN(numValue)) {
            handlePropChange(item.id, prop, { ...(props[prop] as object), [subProp]: numValue });
        }
      } else if (typeof props[name] === 'number') {
        const numValue = parseInt(value, 10);
        if (!isNaN(numValue)) {
            handlePropChange(item.id, name, numValue);
        }
      } else {
        handlePropChange(item.id, name, finalValue);
      }
    };

    return (
        <div className="properties-grid">
            <div className="prop-group-title" style={{ gridColumn: '1 / -1' }}>{isControl ? `${control.type} Properties` : 'Form Properties'}</div>
            
            <div className="prop-group" style={{ gridColumn: '1 / -1' }}>
                <label htmlFor="prop-name">NAME</label>
                <input id="prop-name" name="Name" type="text" value={props.Name} onChange={handleChange} className={`property-input ${propErrors.Name ? 'input-error' : ''}`} />
                {propErrors.Name && <div className="prop-error-msg">{propErrors.Name}</div>}
            </div>

            {props.Text !== undefined && (
                <div className="prop-group" style={{ gridColumn: '1 / -1' }}>
                    <label htmlFor="prop-text">TEXT</label>
                    <input id="prop-text" name="Text" type="text" value={props.Text} onChange={handleChange} className="property-input" />
                </div>
            )}

            <div className="prop-group-title">LAYOUT</div>
            <div className="prop-group">
                <label htmlFor="prop-loc-x">X</label>
                <input id="prop-loc-x" name="Location.X" type="number" value={props.Location.X} onChange={handleChange} className="property-input" disabled={isFormSelected && isFormLocked} />
            </div>
            <div className="prop-group">
                <label htmlFor="prop-loc-y">Y</label>
                <input id="prop-loc-y" name="Location.Y" type="number" value={props.Location.Y} onChange={handleChange} className="property-input" disabled={isFormSelected && isFormLocked} />
            </div>
            <div className="prop-group">
                <label htmlFor="prop-size-w">WIDTH</label>
                <input id="prop-size-w" name="Size.Width" type="number" value={props.Size.Width} onChange={handleChange} className="property-input" />
            </div>
            <div className="prop-group">
                <label htmlFor="prop-size-h">HEIGHT</label>
                <input id="prop-size-h" name="Size.Height" type="number" value={props.Size.Height} onChange={handleChange} className="property-input" />
            </div>
            
            {isControl && <>
                <div className="prop-group-title">SPECIFIC</div>
                {(props as ControlProperties).Checked !== undefined && (
                    <div className="prop-group" style={{ gridColumn: '1 / -1' }}>
                        <label>
                            <input name="Checked" type="checkbox" checked={!!(props as ControlProperties).Checked} onChange={handleChange} />
                            CHECKED
                        </label>
                    </div>
                )}
                
                {control.type === 'Panel' && (
                    <div className="prop-group">
                        <label htmlFor="prop-borderstyle">BORDER STYLE</label>
                        <select id="prop-borderstyle" name="BorderStyle" value={(props as ControlProperties).BorderStyle || 'None'} onChange={handleChange} className="property-select">
                            <option>None</option>
                            <option>FixedSingle</option>
                            <option>Fixed3D</option>
                            <option>Sunken</option>
                        </select>
                    </div>
                )}
                
                 {control.type === 'MaskedTextBox' && (
                    <>
                        <div className="prop-group">
                            <label htmlFor="prop-mask">MASK</label>
                            <input id="prop-mask" name="Mask" type="text" value={(props as ControlProperties).Mask || ''} onChange={handleChange} className="property-input"/>
                        </div>
                        <div className="prop-group">
                            <label htmlFor="prop-placeholder">PLACEHOLDER</label>
                            <input id="prop-placeholder" name="Placeholder" type="text" value={(props as ControlProperties).Placeholder || ''} onChange={handleChange} className="property-input"/>
                        </div>
                    </>
                 )}

                 {control.type === 'LinkLabel' && (
                     <div className="prop-group" style={{ gridColumn: '1 / -1' }}>
                        <label htmlFor="prop-url">URL</label>
                        <input id="prop-url" name="URL" type="text" value={(props as ControlProperties).URL || ''} onChange={handleChange} className="property-input"/>
                    </div>
                 )}

                 {control.type === 'DateTimePicker' && (
                    <div className="prop-group">
                        <label htmlFor="prop-format">FORMAT</label>
                        <select id="prop-format" name="Format" value={(props as ControlProperties).Format || 'Short'} onChange={handleChange} className="property-select">
                            <option>Long</option>
                            <option>Short</option>
                            <option>Time</option>
                        </select>
                    </div>
                 )}

                {control.type === 'SplitContainer' && (
                     <>
                        <div className="prop-group">
                            <label htmlFor="prop-orientation">ORIENTATION</label>
                            <select id="prop-orientation" name="Orientation" value={(props as ControlProperties).Orientation || 'Vertical'} onChange={handleChange} className="property-select">
                                <option>Vertical</option>
                                <option>Horizontal</option>
                            </select>
                        </div>
                        <div className="prop-group" style={{ gridColumn: '1 / -1' }}>
                            <label htmlFor="prop-splitterdistance">SPLITTER DISTANCE</label>
                            <div className="input-slider-group">
                              <input id="prop-splitterdistance" name="SplitterDistance" type="number" value={(props as ControlProperties).SplitterDistance || 150} onChange={handleChange} className="property-input"/>
                              <input type="range" 
                                     min="20" 
                                     max={(props as ControlProperties).Orientation === 'Vertical' ? props.Size.Width - 20 : props.Size.Height - 20} 
                                     value={(props as ControlProperties).SplitterDistance || 150} 
                                     onChange={handleChange}
                                     name="SplitterDistance"
                                     className="property-slider" />
                            </div>
                        </div>
                    </>
                )}

                {(control.type === 'ProgressBar' || control.type === 'TrackBar') && (
                    <>
                        <div className="prop-group">
                            <label htmlFor="prop-min">MINIMUM</label>
                            <input id="prop-min" name="Minimum" type="number" value={(props as ControlProperties).Minimum || 0} onChange={handleChange} className="property-input"/>
                        </div>
                        <div className="prop-group">
                            <label htmlFor="prop-max">MAXIMUM</label>
                            <input id="prop-max" name="Maximum" type="number" value={(props as ControlProperties).Maximum || 100} onChange={handleChange} className="property-input"/>
                        </div>
                        <div className="prop-group" style={{ gridColumn: '1 / -1' }}>
                            <label htmlFor="prop-value">VALUE</label>
                             <div className="input-slider-group">
                                <input id="prop-value" name="Value" type="number" value={(props as ControlProperties).Value || 0} onChange={handleChange} className="property-input"/>
                                <input type="range" 
                                       min={(props as ControlProperties).Minimum || 0} 
                                       max={(props as ControlProperties).Maximum || 100} 
                                       value={(props as ControlProperties).Value || 0} 
                                       onChange={handleChange}
                                       name="Value"
                                       className="property-slider" />
                             </div>
                        </div>
                    </>
                )}
            </>}
        </div>
    );
  };
  
  const renderControl = (c: Control) => {
    const isSelected = selectedItemIds.includes(c.id);
    const isDragging = dragState.current?.items.some(i => i.id === c.id) ?? false;
    const isColliding = isDragging && dragState.current?.isColliding;
    const isPotentialParent = (c.type === 'GroupBox' || c.type === 'Panel' || c.type === 'SplitContainer') && c.id === potentialParentId;
    const { Name, Text, Size, Checked, Value, Minimum, Maximum, BorderStyle, Placeholder, URL, Orientation, SplitterDistance } = c.properties;

    const baseClasses = `canvas-control ${isSelected ? 'selected' : ''} ${isDragging ? 'dragging' : ''} ${isColliding ? 'colliding' : ''} ${isPotentialParent ? 'potential-parent' : ''}`;
    
    let style: React.CSSProperties = {
        left: c.properties.Location.X,
        top: c.properties.Location.Y,
        width: Size.Width,
        height: Size.Height,
        zIndex: isSelected ? 100 : 10
    };
    
    const renderChildren = () => currentForm.controls
        .filter(child => child.parentId === c.id && child.splitterPanel !== 2)
        .map(renderControl);

    const renderChildrenPanel2 = () => currentForm.controls
        .filter(child => child.parentId === c.id && child.splitterPanel === 2)
        .map(renderControl);

    let innerContent;
    switch (c.type) {
        case 'GroupBox':
            innerContent = <div className="control-inner groupbox-style"><span className="groupbox-text">{Text}</span>{renderChildren()}</div>;
            break;
        case 'Panel':
            innerContent = <div className={`control-inner panel-style border-${(BorderStyle || 'none').toLowerCase()}`}>{renderChildren()}</div>;
            break;
        case 'SplitContainer':
             const isVertical = Orientation === 'Vertical';
             const splitterPos = SplitterDistance || 150;
             innerContent = <div className="control-inner splitcontainer-style">
                <div className="splitcontainer-panel1" style={{ position: 'absolute', top: 0, left: 0, width: isVertical ? splitterPos : '100%', height: isVertical ? '100%' : splitterPos }}>
                    {renderChildren()}
                </div>
                 <div className="splitcontainer-panel2" style={{ position: 'absolute', top: isVertical ? 0 : splitterPos, left: isVertical ? splitterPos : 0, right: 0, bottom: 0}}>
                    {renderChildrenPanel2()}
                </div>
                <div className="splitcontainer-splitter" 
                     style={isVertical ? { left: splitterPos - 2, top: 0, width: 4, height: '100%', cursor: 'ew-resize' } : { top: splitterPos - 2, left: 0, height: 4, width: '100%', cursor: 'ns-resize' }}
                     onPointerDown={(e) => handleSplitterPointerDown(e, c.id)}
                />
            </div>
            break;
        case 'CheckBox':
        case 'RadioButton':
            const shapeClass = c.type === 'CheckBox' ? 'checkbox-box' : 'radio-circle';
            innerContent = <div className={`control-inner ${c.type.toLowerCase()}-style`}><span className={`${shapeClass} ${Checked ? 'checked' : ''}`}></span><span>{Text}</span></div>;
            break;
        case 'ProgressBar':
            const progress = ((Value || 0) - (Minimum || 0)) / ((Maximum || 100) - (Minimum || 0)) * 100;
            innerContent = <div className="control-inner progressbar-style"><div className="progressbar-fill" style={{width: `${progress}%`}}></div></div>;
            break;
        case 'TrackBar':
            const trackPos = ((Value || 0) - (Minimum || 0)) / ((Maximum || 100) - (Minimum || 0)) * 100;
            innerContent = <div className="control-inner trackbar-style"><div className="trackbar-track"><div className="trackbar-thumb" style={{left: `${trackPos}%`}}></div></div></div>
            break;
        case 'Label':
             innerContent = <div className="control-inner label-style">{Text}</div>;
            break;
        case 'MaskedTextBox':
             innerContent = <div className="control-inner maskedtextbox-style" data-placeholder={Placeholder}>{Text}</div>;
             break;
        case 'LinkLabel':
            innerContent = <div className="control-inner linklabel-style">{Text}</div>;
            break;
        case 'DateTimePicker':
            innerContent = <div className="control-inner datetimepicker-style"><span>{new Date().toLocaleDateString()}</span> <CalendarIcon className="datepicker-icon"/></div>;
            break;
        case 'TextBox':
        case 'RichTextBox':
             innerContent = <div className={`control-inner ${c.type.toLowerCase()}-style`}>{Text}</div>;
             break;
        default:
            innerContent = <div className="control-inner">{Text}</div>;
    }

    return (
        <div key={c.id} id={c.id} className={baseClasses} style={style} onPointerDown={e => handlePointerDown(e, c.id, 'move')}>
            {innerContent}
            {isSelected && <div className="resize-handle" onPointerDown={(e) => handlePointerDown(e, c.id, 'resize')}></div>}
        </div>
    );
  };
  
  const renderMenuEditor = () => {
    const renderItems = (items: MenuItem[], path: string[]) => (
      <ul className="menu-editor-list">
        {items.map(item => (
          <li key={item.id} className="menu-editor-item">
            <div className="menu-item-text-wrapper">
              <input type="text" value={item.text} onChange={(e) => updateMenuItem([...path, item.id], e.target.value)} className="property-input submenu-input" />
              <div className="menu-item-actions">
                <button title="Add Sub-item" className="menu-action-btn" onClick={() => addMenuItem([...path, item.id])}><PlusIcon className="icon"/></button>
                <button title="Remove Item" className="menu-action-btn" onClick={() => removeMenuItem([...path, item.id])}><TrashIcon className="icon"/></button>
              </div>
            </div>
            {item.items && item.items.length > 0 && renderItems(item.items, [...path, item.id])}
          </li>
        ))}
      </ul>
    );

    return (
      <div className="menu-editor-container">
        {renderItems(currentForm.properties.menu || [], [])}
        <button className="tool-button" onClick={() => addMenuItem([])}>
          <PlusIcon className="icon" /> Add Top-Level Menu
        </button>
      </div>
    );
  };
  
  const renderEvents = () => {
      if (!isSingleControlSelected || !selectedItem) return <p>Select a single control to see its events.</p>;
      const availableEvents = CONTROL_EVENTS[selectedItem.type] || [];
      if (availableEvents.length === 0) return <p>This control has no supported events.</p>;
      
      return (
          <div className="events-panel">
            {availableEvents.map(eventName => (
                <div key={eventName} className="event-editor">
                    <label className="event-editor-label">{selectedItem.properties.Name}.{eventName}</label>
                    <div className="code-editor-wrapper">
                        <CodeEditor
                            value={selectedItem.properties.events?.[eventName]?.[targetLanguage] || ''}
                            onValueChange={code => handleEventCodeChange(selectedItem.id, eventName, code)}
                            language={targetLanguage}
                            placeholder={`Enter ${targetLanguage} code here...`}
                        />
                    </div>
                </div>
            ))}
          </div>
      );
  }

  const renderCode = () => (
    <div className="code-panel-container">
        <div className="code-actions-header">
            <div className="language-selector">
                <button className={`lang-button ${targetLanguage === 'powershell' ? 'active' : ''}`} onClick={() => setTargetLanguage('powershell')}>PowerShell</button>
                <button className={`lang-button ${targetLanguage === 'python' ? 'active' : ''}`} onClick={() => setTargetLanguage('python')}>Python</button>
            </div>
            <div className="code-main-actions">
                <button className="tool-button" onClick={handleGenerateCode} disabled={isGenerating}>
                    <CodeIcon className="icon" /> {isGenerating ? 'Generating...' : 'Generate Code'}
                </button>
                 <button className="tool-button" onClick={handleCopyCode} disabled={!generatedCode}><CopyIcon className="icon"/> {copyStatus}</button>
                <button className="tool-button" onClick={handleSaveCode} disabled={!generatedCode}><SaveIcon className="icon"/> Save</button>
            </div>
        </div>

        <hr className="code-actions-divider" />

        <div className="code-editor-wrapper">
            {error && <div className="error-message">{error}</div>}
            <CodeEditor
                value={generatedCode}
                onValueChange={setGeneratedCode}
                language={targetLanguage}
                readOnly={true}
                placeholder="Generated code will appear here..."
            />
        </div>
        
        <div className="ai-enhancement-section">
            <h3 className="ai-enhancement-title">AI ENHANCEMENT</h3>
            <textarea
                className="ai-enhancement-prompt"
                placeholder="Describe a change or new feature... e.g., 'Add a function to the About button that reads a version from a text file and displays it.'"
                value={enhancementPrompt}
                onChange={e => setEnhancementPrompt(e.target.value)}
                disabled={isGenerating || !generatedCode}
            />
            <button className="tool-button" onClick={handleEnhanceCode} disabled={isGenerating || !generatedCode || !enhancementPrompt}>
                <WandIcon className="icon" /> {isGenerating ? 'Enhancing...' : 'Enhance with AI'}
            </button>
        </div>
    </div>
  );

  return (
    <div className="app-container">
      {/* FIX: SettingsModal removed to comply with API key guidelines requiring environment variables. */}

      {contextMenu.visible && (
        <div className="context-menu" style={{ top: contextMenu.y, left: contextMenu.x }} onPointerDown={e => e.stopPropagation()}>
          <div className="context-menu-item-header">CyberForm v1.0.0</div>
          <div className="context-menu-item-info">By Elton Boehnen</div>
          <div className="context-menu-separator"></div>
          <div className="context-menu-item" onClick={handleCopy}>Copy Selected</div>
          <div className="context-menu-item" onClick={handlePaste}>Paste</div>
          <div className="context-menu-item" onClick={deleteSelectedItems}>Delete</div>
          <div className="context-menu-separator"></div>
          <a href="https://github.com/boehnenelton" target="_blank" rel="noopener noreferrer"><div className="context-menu-item">Author's GitHub</div></a>
        </div>
      )}
      
      <button className="hamburger-button" onClick={() => setIsSidebarOpen(true)}>
        <MenuIcon className="icon" />
      </button>

      <div 
        className={`sidebar-overlay ${isSidebarOpen ? 'visible' : ''}`}
        onClick={() => setIsSidebarOpen(false)}
      ></div>

      <div className={`left-panel ${isSidebarOpen ? 'open' : ''}`}>
        <button className="close-sidebar-button" onClick={() => setIsSidebarOpen(false)}>
            <XIcon className="icon" />
        </button>
        <div className="panel-section form-controls">
          <h2 className="panel-title">Forms</h2>
          <ul>
            {forms.map((form, index) => (
                <li key={form.id} 
                    className={`form-item ${form.isEnabled ? 'enabled' : ''} ${index === currentFormIndex ? 'active' : ''} ${selectedItemIds.includes(form.id) ? 'hard-active' : ''}`}
                    onClick={() => { setCurrentFormIndex(index); setSelectedItemIds([form.id]); setActiveTab('properties'); setIsSidebarOpen(false); }}
                >
                    <label className="form-item-label">
                        <input type="checkbox" checked={form.isEnabled} onChange={() => handleToggleForm(form.id)} />
                        {form.properties.Name}
                    </label>
                </li>
            ))}
          </ul>
        </div>
        <div className="panel-section">
          <h2 className="panel-title">Toolbox</h2>
          <div className="toolbox">
            {(Object.keys(CONTROL_EVENTS) as ControlType[]).map(type => 
              <button key={type} className="tool-button" onClick={() => addControl(type)}>{type}</button>
            )}
            <button className="tool-button" onClick={() => addControl('GroupBox')}>GroupBox</button>
            <button className="tool-button" onClick={() => addControl('Panel')}>Panel</button>
            <button className="tool-button" onClick={() => addControl('RichTextBox')}>RichTextBox</button>
            <button className="tool-button" onClick={() => addControl('ProgressBar')}>ProgressBar</button>
            <button className="tool-button" onClick={() => addControl('TrackBar')}>TrackBar</button>
            <button className="tool-button" onClick={() => addControl('DateTimePicker')}>DateTimePicker</button>
            <button className="tool-button" onClick={() => addControl('SplitContainer')}>SplitContainer</button>
          </div>
        </div>
      </div>

      <div className="main-content">
        <div 
            className="canvas-container"
            ref={canvasRef}
            onPointerMove={handlePointerMoveOnCanvas}
            onContextMenu={handleContextMenu}
        >
          <div className="hud">
              <div className="hud-left">
                <span className={`hud-coords ${isPointerInForm ? 'valid' : 'invalid'}`}>
                  X: {pointerPos.x.toFixed(0)}, Y: {pointerPos.y.toFixed(0)}
                </span>
              </div>
              <div className="hud-right">
                <button className={`hud-button ${isGridVisible ? 'active' : ''}`} title="Toggle Grid" onClick={() => setIsGridVisible(v => !v)}><GridIcon /></button>
                <button className={`hud-button ${isSnapToGridEnabled ? 'active' : ''}`} title="Snap to Grid" onClick={() => setIsSnapToGridEnabled(v => !v)}><MagnetIcon /></button>
                <button className={`hud-button ${isFormLocked ? 'active' : ''}`} title={isFormLocked ? 'Unlock Form Position' : 'Lock Form Position'} onClick={() => setIsFormLocked(v => !v)}>
                  {isFormLocked ? <LockIcon /> : <UnlockIcon />}
                </button>
                {/* FIX: Settings button removed to comply with API key guidelines. */}
              </div>
          </div>

          <div 
            id={currentForm.id}
            className={`form-grid ${!isFormLocked ? 'draggable' : ''} ${isGridVisible ? 'grid-visible' : ''}`}
            onPointerDown={(e) => handlePointerDown(e, currentForm.id, 'move')}
            style={{ 
              transform: `translate(${currentForm.properties.Location.X}px, ${currentForm.properties.Location.Y}px)`,
              width: currentForm.properties.Size.Width,
              height: currentForm.properties.Size.Height,
              '--grid-size': `${GRID_SIZE}px`
            } as React.CSSProperties}
          >
             {currentForm.properties.menu && currentForm.properties.menu.length > 0 && (
              <div className="form-menu-bar">
                {currentForm.properties.menu.map(item => <span key={item.id} className="form-menu-item">{item.text}</span>)}
              </div>
            )}
            {currentForm.controls.filter(c => !c.parentId).map(renderControl)}
          </div>
          
          {ripples.map(r => <div key={r.id} className={r.type === 'ripple' ? 'ripple-effect' : 'wormhole-effect'} style={{ top: r.y, left: r.x }}></div>)}
        </div>
        
        <div className="bottom-panel" style={{ height: panelHeight }}>
          <div className="panel-resizer" onPointerDown={handlePanelResizePointerDown}></div>
          <nav className="tab-nav">
              <button className={`cyber-tab ${activeTab === 'properties' ? 'active' : ''}`} onClick={() => setActiveTab('properties')}>Properties</button>
              <button className={`cyber-tab ${activeTab === 'events' ? 'active' : ''}`} onClick={() => setActiveTab('events')} disabled={!isSingleControlSelected}>Events</button>
              <button className={`cyber-tab ${activeTab === 'menu' ? 'active' : ''}`} onClick={() => setActiveTab('menu')} disabled={!isFormSelected}>Menu</button>
              <button className={`cyber-tab ${activeTab === 'code' ? 'active' : ''}`} onClick={() => setActiveTab('code')}>Code</button>
          </nav>
          <div className="tab-content">
              {activeTab === 'properties' && renderProperties()}
              {activeTab === 'events' && renderEvents()}
              {activeTab === 'menu' && renderMenuEditor()}
              {activeTab === 'code' && renderCode()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;