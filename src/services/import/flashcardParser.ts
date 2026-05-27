/**
 * src/services/import/flashcardParser.ts
 * Parse Excel/CSV/DOCX (2 cột: front, back) thành danh sách thẻ
 */

import * as XLSX from 'xlsx';
import { readFileAsArrayBuffer, isWordFile } from './utils';
import { FlashcardCard, ParsedFlashcardData, ImportError } from './types';
import * as mammoth from 'mammoth';

interface FlashcardRow {
  front: string;
  back: string;
  hint?: string;
}

async function parseExcelToFlashcards(file: File): Promise<FlashcardRow[]> {
  const buffer = await readFileAsArrayBuffer(file);
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet) as any[];
  return data.map(row => ({
    front: row.Front?.toString().trim() || row.front?.toString().trim() || '',
    back: row.Back?.toString().trim() || row.back?.toString().trim() || '',
    hint: row.Hint?.toString().trim() || row.hint?.toString().trim(),
  })).filter(r => r.front && r.back);
}

async function parseDocxToFlashcards(file: File): Promise<FlashcardRow[]> {
  const buffer = await readFileAsArrayBuffer(file);
  const result = await mammoth.extractRawText({ arrayBuffer: buffer });
  const lines = result.value.split('\n').filter(l => l.trim());
  // Dòng có dạng "Front | Back" hoặc "Front,Back"
  const rows: FlashcardRow[] = [];
  for (const line of lines) {
    const parts = line.includes('|') ? line.split('|').map(s => s.trim()) : line.split(',').map(s => s.trim());
    if (parts.length >= 2) {
      rows.push({ front: parts[0], back: parts[1], hint: parts[2] });
    }
  }
  return rows;
}

export async function parseFlashcardFile(file: File): Promise<ParsedFlashcardData> {
  try {
    let rows: FlashcardRow[];
    if (isWordFile(file)) {
      rows = await parseDocxToFlashcards(file);
    } else {
      rows = await parseExcelToFlashcards(file);
    }

    const errors: ImportError[] = [];
    const warnings: string[] = [];

    if (rows.length === 0) {
      errors.push({ row: 0, message: 'No flashcards found. Ensure file has columns Front and Back.' });
    }

    const cards: FlashcardCard[] = rows.map((row, idx) => ({
      id: `fc_import_${Date.now()}_${idx}`,
      front: row.front,
      back: row.back,
      hint: row.hint,
    }));

    return { cards, errors, warnings };
  } catch (err: any) {
    console.error('Flashcard parse error:', err);
    return { cards: [], errors: [{ row: 0, message: err.message || 'Failed to parse file' }], warnings: [] };
  }
}