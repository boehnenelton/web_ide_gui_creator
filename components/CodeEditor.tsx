import React from 'react';
import Editor from 'react-simple-code-editor';

interface CodeEditorProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  language: 'powershell' | 'python';
}

const highlightPowerShell = (code: string) =>
  code
    .replace(/\b(function|if|else|foreach|for|while|switch|return|param|try|catch|finally|throw|Add-Type|New-Object|Out-Null)\b/gi, '<span style="color: #c586c0;">$1</span>')
    .replace(/(\$[a-zA-Z_][a-zA-Z0-9_]*)/gi, '<span style="color: #9cdcfe;">$1</span>') // Variables
    .replace(/(#.*)/g, '<span style="color: #6a9955;">$1</span>') // Comments
    .replace(/"(.*?)"/g, '<span style="color: #ce9178;">"$1"</span>') // Strings
    .replace(/'(.*?)'/g, '<span style="color: #ce9178;">\'$1\'</span>');

const highlightPython = (code: string) => 
  code
    .replace(/\b(import|from|def|class|if|else|elif|for|while|return|try|except|finally|with|as|in|not|and|or)\b/gi, '<span style="color: #c586c0;">$1</span>') // Keywords
    .replace(/\b(True|False|None)\b/g, '<span style="color: #4fc1ff;">$1</span>') // Constants
    .replace(/(\b[A-Z][a-zA-Z0-9_]*\b)/g, '<span style="color: #4ec9b0;">$1</span>') // Classes/Types
    .replace(/(#.*)/g, '<span style="color: #6a9955;">$1</span>') // Comments
    .replace(/"(.*?)"/g, '<span style="color: #ce9178;">"$1"</span>') // Strings
    .replace(/'(.*?)'/g, '<span style="color: #ce9178;">\'$1\'</span>');


const CodeEditor: React.FC<CodeEditorProps> = ({ value, onValueChange, placeholder, readOnly = false, language }) => {
  return (
    <div className="relative h-full w-full">
      <Editor
        value={value}
        onValueChange={onValueChange}
        highlight={language === 'python' ? highlightPython : highlightPowerShell}
        padding={16}
        className="code-editor-root h-full"
        textareaClassName="code-editor-textarea"
        preClassName="code-editor-pre"
        placeholder={placeholder}
        readOnly={readOnly}
      />
    </div>
  );
};

export default CodeEditor;