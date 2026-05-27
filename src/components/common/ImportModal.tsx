/**
 * src/components/common/ImportModal.tsx
 * Modal dùng chung cho import file (drag & drop, preview, chỉnh sửa)
 */

import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { X, Upload, AlertCircle, CheckCircle, Loader, FileText, Edit3 } from 'lucide-react';
import { ImportModalState } from '../../hooks/useFileImport';

interface ImportModalProps<T> {
  state: ImportModalState<T>;
  onClose: () => void;
  onFileSelect: (file: File) => void;
  onConfirm: () => void;
  onUpdatePreview?: (newData: T) => void;
  title?: string;
  accept?: Record<string, string[]>;
  renderPreview: (data: T, onUpdate?: (newData: T) => void) => React.ReactNode;
}

export function ImportModal<T>({
  state,
  onClose,
  onFileSelect,
  onConfirm,
  onUpdatePreview,
  title = 'Import from file',
  accept = {
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    'application/vnd.ms-excel': ['.xls'],
    'text/csv': ['.csv'],
    'application/msword': ['.doc'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    'application/pdf': ['.pdf'],
    'text/markdown': ['.md', '.markdown'],
    'text/plain': ['.txt'],
  },
  renderPreview,
}: ImportModalProps<T>) {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length) onFileSelect(acceptedFiles[0]);
  }, [onFileSelect]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
    maxFiles: 1,
  });

  if (!state.isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(6px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 900,
          maxHeight: '90vh',
          background: 'rgba(26,26,46,0.97)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 24,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'scaleIn 0.2s ease',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: '#E4E1EE' }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#C7C4D8' }}>
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
          {state.step === 'select' && (
            <div
              {...getRootProps()}
              style={{
                border: `2px dashed ${isDragActive ? 'rgba(108,99,255,0.7)' : 'rgba(255,255,255,0.2)'}`,
                borderRadius: 16,
                background: isDragActive ? 'rgba(108,99,255,0.05)' : 'rgba(255,255,255,0.02)',
                padding: 40,
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              <input {...getInputProps()} />
              <Upload size={40} color="#C7C4D8" style={{ marginBottom: 12 }} />
              <p style={{ fontSize: 14, color: '#E4E1EE', marginBottom: 8 }}>
                {isDragActive ? 'Drop file here' : 'Drag & drop or click to select'}
              </p>
              <p style={{ fontSize: 12, color: '#C7C4D8' }}>Supports: XLSX, CSV, DOCX, PDF, MD, TXT</p>
            </div>
          )}

          {state.step === 'preview' && (
            <>
              {state.parsing && (
                <div style={{ textAlign: 'center', padding: 40 }}>
                  <Loader size={32} color="#6C63FF" style={{ animation: 'spin 0.8s linear infinite', marginBottom: 16 }} />
                  <p style={{ color: '#C7C4D8' }}>Parsing file...</p>
                </div>
              )}

              {!state.parsing && state.errors.length > 0 && (
                <div style={{ background: 'rgba(255,180,171,0.1)', border: '1px solid rgba(255,180,171,0.3)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <AlertCircle size={18} color="#ffb4ab" />
                    <span style={{ fontWeight: 700, color: '#ffb4ab' }}>Parse errors</span>
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 20, color: '#C7C4D8', fontSize: 13 }}>
                    {state.errors.map((err, idx) => (
                      <li key={idx}>Row {err.row}: {err.message}</li>
                    ))}
                  </ul>
                </div>
              )}

              {!state.parsing && state.warnings.length > 0 && (
                <div style={{ background: 'rgba(255,183,133,0.1)', border: '1px solid rgba(255,183,133,0.3)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <AlertCircle size={18} color="#FFB785" />
                    <span style={{ fontWeight: 700, color: '#FFB785' }}>Warnings</span>
                  </div>
                  <ul style={{ margin: 8, paddingLeft: 20, color: '#C7C4D8', fontSize: 13 }}>
                    {state.warnings.map((w, idx) => <li key={idx}>{w}</li>)}
                  </ul>
                </div>
              )}

              {!state.parsing && state.previewData && (
                renderPreview(state.previewData, onUpdatePreview)
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              borderRadius: 10,
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: '#C7C4D8',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          {state.step === 'preview' && !state.parsing && state.errors.length === 0 && state.previewData && (
            <button
              onClick={onConfirm}
              style={{
                padding: '8px 20px',
                borderRadius: 10,
                background: 'linear-gradient(135deg,#6C63FF,#9B59B6)',
                border: 'none',
                color: '#fff',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Import
            </button>
          )}
        </div>
      </div>
    </div>
  );
}