/**
 * src/hooks/useFileImport.ts
 * Quản lý trạng thái import file, preview, confirm
 */

import { useState, useCallback } from 'react';

export interface ImportModalState<T> {
  isOpen: boolean;
  file: File | null;
  parsing: boolean;
  previewData: T | null;
  errors: any[];
  warnings: string[];
  step: 'select' | 'preview';
}

export interface UseFileImportOptions<T> {
  parser: (file: File) => Promise<T>;
  onConfirm: (data: T) => void;
  resetOnClose?: boolean;
}

export function useFileImport<T>({ parser, onConfirm, resetOnClose = true }: UseFileImportOptions<T>) {
  const [state, setState] = useState<ImportModalState<T>>({
    isOpen: false,
    file: null,
    parsing: false,
    previewData: null,
    errors: [],
    warnings: [],
    step: 'select',
  });

  const openModal = useCallback(() => {
    setState(prev => ({ ...prev, isOpen: true, step: 'select', file: null, previewData: null, errors: [], warnings: [] }));
  }, []);

  const closeModal = useCallback(() => {
    if (resetOnClose) {
      setState({
        isOpen: false,
        file: null,
        parsing: false,
        previewData: null,
        errors: [],
        warnings: [],
        step: 'select',
      });
    } else {
      setState(prev => ({ ...prev, isOpen: false }));
    }
  }, [resetOnClose]);

  const handleFileSelect = useCallback(async (file: File) => {
    setState(prev => ({ ...prev, file, parsing: true, step: 'preview' }));
    try {
      const result = await parser(file);
      setState(prev => ({
        ...prev,
        parsing: false,
        previewData: result,
        errors: (result as any).errors || [],
        warnings: (result as any).warnings || [],
      }));
    } catch (err: any) {
      setState(prev => ({
        ...prev,
        parsing: false,
        errors: [{ row: 0, message: err.message }],
        warnings: [],
      }));
    }
  }, [parser]);

  const confirmImport = useCallback(() => {
    if (state.previewData) {
      onConfirm(state.previewData);
      closeModal();
    }
  }, [state.previewData, onConfirm, closeModal]);

  const updatePreviewData = useCallback((newData: T) => {
    setState(prev => ({ ...prev, previewData: newData }));
  }, []);

  return {
    ...state,
    openModal,
    closeModal,
    handleFileSelect,
    confirmImport,
    updatePreviewData,
  };
}