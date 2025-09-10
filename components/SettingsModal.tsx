import React, { useRef, useEffect } from 'react';
import { serviceDetails } from '../data/keyTemplate';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: () => void;
  onImport: (file: File) => void;
  loadedServices: string[];
  error: string | null;
  clearError: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onExport, onImport, loadedServices, error, clearError }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Clear any previous errors when the modal opens
    if (isOpen) {
      clearError();
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onImport(file);
    }
     // Reset the input value to allow re-uploading the same file
    if(event.target) {
      event.target.value = '';
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">API Key Management</h2>
          <button className="modal-close-button" onClick={onClose}>&times;</button>
        </div>
        
        <p>Import your API keys from a JSON file. You can export a template to get started. The AI Enhancement feature requires a Google Gemini key.</p>
        
        {error && <div className="error-message">{error}</div>}

        <ul className="key-status-list">
          {Object.entries(serviceDetails).map(([key, details]) => {
            const isLoaded = loadedServices.includes(key);
            return (
              <li key={key} className={`key-status-item ${isLoaded ? 'loaded' : ''}`}>
                <span className="service-name">{details.name}</span>
                <span className={`status ${isLoaded ? 'loaded' : 'missing'}`}>
                  {isLoaded ? 'LOADED' : 'MISSING'}
                </span>
              </li>
            );
          })}
        </ul>

        <div className="modal-actions">
          <button className="tool-button" onClick={onExport}>Export Template</button>
          <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".json" style={{ display: 'none' }} />
          <button className="tool-button" onClick={handleImportClick}>Import Keys</button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
