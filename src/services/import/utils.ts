/**
 * src/services/import/utils.ts
 * Helper: đọc file blob, kiểm tra loại file, chuyển đổi
 */

export const readFileAsText = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = (e) => reject(e);
    reader.readAsText(file);
  });
};

export const readFileAsArrayBuffer = (file: File): Promise<ArrayBuffer> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as ArrayBuffer);
    reader.onerror = (e) => reject(e);
    reader.readAsArrayBuffer(file);
  });
};

export const isExcelFile = (file: File): boolean => {
  const ext = file.name.split('.').pop()?.toLowerCase();
  return ext === 'xlsx' || ext === 'xls' || ext === 'csv';
};

export const isWordFile = (file: File): boolean => {
  const ext = file.name.split('.').pop()?.toLowerCase();
  return ext === 'docx' || ext === 'doc';
};

export const isPDFFile = (file: File): boolean => {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
};

export const isMarkdownFile = (file: File): boolean => {
  const ext = file.name.split('.').pop()?.toLowerCase();
  return ext === 'md' || ext === 'markdown';
};

export const isTextFile = (file: File): boolean => {
  return file.type === 'text/plain' || file.name.toLowerCase().endsWith('.txt');
};