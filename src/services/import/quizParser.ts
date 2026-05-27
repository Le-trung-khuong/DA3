/**
 * src/services/import/quizParser.ts
 * Parse Excel/CSV/DOCX (bảng) thành danh sách câu hỏi multiple choice
 * Hỗ trợ mapping column linh hoạt
 */

import * as XLSX from 'xlsx';
import { readFileAsArrayBuffer, isWordFile } from './utils';
import { QuizQuestion, QuizColumnMapping, ParsedQuizData, ImportError } from './types';
import * as mammoth from 'mammoth';

/**
 * Đọc sheet đầu tiên từ file Excel/CSV → mảng 2 chiều
 */
async function parseExcelToMatrix(file: File): Promise<any[][]> {
  const buffer = await readFileAsArrayBuffer(file);
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  return data as any[][];
}

/**
 * Parse bảng từ file .docx (giả định bảng đầu tiên)
 */
async function parseDocxTableToMatrix(file: File): Promise<any[][]> {
  const buffer = await readFileAsArrayBuffer(file);
  const result = await mammoth.extractRawText({ arrayBuffer: buffer });
  // Cách đơn giản: tách dòng và cột bằng tab (không chính xác tuyệt đối, nhưng tạm chấp nhận)
  const lines = result.value.split('\n').filter(l => l.trim());
  const matrix = lines.map(line => line.split(/\t|,|;/).map(cell => cell.trim()));
  return matrix;
}

/**
 * Nhận diện header tự động (dòng đầu tiên có chứa từ khoá question, option, etc.)
 * Trả về mapping gợi ý
 */
export function detectQuizColumns(headerRow: string[]): Partial<QuizColumnMapping> {
  const mapping: Partial<QuizColumnMapping> = {};
  const lowerHeaders = headerRow.map(h => h.toLowerCase());
  for (let i = 0; i < lowerHeaders.length; i++) {
    const h = lowerHeaders[i];
    if (h.includes('question') || h === 'q' || h === 'câu hỏi') {
      mapping.questionCol = i;
    }
    if (h.includes('correct') || h === 'answer' || h === 'đáp án') {
      mapping.correctCol = i;
    }
    if (h.includes('explain') || h === 'giải thích') {
      mapping.explanationCol = i;
    }
    if (h === 'option a' || h === 'a') mapping.optionCols = [...(mapping.optionCols || []), i];
    if (h === 'option b' || h === 'b') mapping.optionCols = [...(mapping.optionCols || []), i];
    if (h === 'option c' || h === 'c') mapping.optionCols = [...(mapping.optionCols || []), i];
    if (h === 'option d' || h === 'd') mapping.optionCols = [...(mapping.optionCols || []), i];
  }
  // Nếu không tìm thấy optionCols, thử lấy các cột còn lại (trừ question, correct, explanation)
  if (!mapping.optionCols?.length) {
    const exclude = new Set([mapping.questionCol, mapping.correctCol, mapping.explanationCol].filter(v => v !== undefined));
    mapping.optionCols = headerRow.map((_, i) => i).filter(i => !exclude.has(i)).slice(0, 4);
  }
  return mapping;
}

/**
 * Chuyển giá trị đáp án đúng (có thể là "A", "B", "C", "D" hoặc nội dung option) thành index
 */
function resolveCorrectIndex(correctValue: string, options: string[]): number {
  const trimmed = correctValue.trim().toUpperCase();
  // Nếu là A, B, C, D
  if (trimmed === 'A') return 0;
  if (trimmed === 'B') return 1;
  if (trimmed === 'C') return 2;
  if (trimmed === 'D') return 3;
  // Nếu là nội dung option
  const idx = options.findIndex(opt => opt.toLowerCase() === trimmed.toLowerCase());
  if (idx >= 0) return idx;
  // Mặc định 0
  return 0;
}

/**
 * Parse matrix thành danh sách câu hỏi dựa trên mapping
 */
function matrixToQuestions(
  matrix: any[][],
  mapping: QuizColumnMapping,
  hasHeader: boolean = true
): ParsedQuizData {
  const startRow = hasHeader ? 1 : 0;
  const questions: QuizQuestion[] = [];
  const errors: ImportError[] = [];
  const warnings: string[] = [];

  for (let i = startRow; i < matrix.length; i++) {
    const row = matrix[i];
    const questionText = row[mapping.questionCol]?.toString().trim() || '';
    if (!questionText) {
      errors.push({ row: i + 1, message: 'Question text is empty' });
      continue;
    }

    const options: string[] = [];
    for (let j = 0; j < 4; j++) {
      const optCol = mapping.optionCols[j];
      if (optCol !== undefined && optCol < row.length) {
        options.push(row[optCol]?.toString().trim() || `Option ${j+1}`);
      } else {
        options.push(`Option ${j+1}`);
      }
    }

    let correctIndex = 0;
    let rawCorrect = row[mapping.correctCol]?.toString().trim() || '';
    if (rawCorrect) {
      correctIndex = resolveCorrectIndex(rawCorrect, options);
    } else {
      errors.push({ row: i + 1, message: 'Correct answer is missing' });
      continue;
    }

    const explanation = mapping.explanationCol !== undefined ? row[mapping.explanationCol]?.toString().trim() : undefined;

    const newId = `q_import_${Date.now()}_${i}`;
    questions.push({
      id: newId,
      text: questionText,
      options,
      correctOptionIndex: correctIndex,
      explanation,
    });
  }

  if (questions.length === 0 && errors.length === 0) {
    warnings.push('No questions were parsed. Check file format and mapping.');
  }

  return { questions, errors, warnings };
}

export async function parseQuizFile(
  file: File,
  customMapping?: Partial<QuizColumnMapping>
): Promise<ParsedQuizData> {
  try {
    let matrix: any[][];
    if (isWordFile(file)) {
      matrix = await parseDocxTableToMatrix(file);
    } else {
      matrix = await parseExcelToMatrix(file);
    }

    if (!matrix.length) {
      return { questions: [], errors: [{ row: 0, message: 'File is empty' }], warnings: [] };
    }

    const headerRow = matrix[0];
    let finalMapping: QuizColumnMapping = {
      questionCol: 0,
      optionCols: [1, 2, 3, 4],
      correctCol: 5,
    };

    if (customMapping && Object.keys(customMapping).length) {
      finalMapping = { ...finalMapping, ...customMapping } as QuizColumnMapping;
    } else {
      // Tự động phát hiện nếu không có mapping
      const auto = detectQuizColumns(headerRow);
      finalMapping = { ...finalMapping, ...auto };
    }

    // Validate mapping có đủ optionCols không
    if (finalMapping.optionCols.length < 2) {
      return { questions: [], errors: [{ row: 0, message: 'Could not determine option columns. Please provide custom mapping.' }], warnings: [] };
    }

    return matrixToQuestions(matrix, finalMapping, true);
  } catch (err: any) {
    console.error('Quiz parse error:', err);
    return { questions: [], errors: [{ row: 0, message: err.message || 'Failed to parse file' }], warnings: [] };
  }
}