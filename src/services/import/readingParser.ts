/**
 * src/services/import/readingParser.ts
 * Parse các định dạng file thành markdown string (tối ưu cho hiển thị)
 */

import { readFileAsArrayBuffer, readFileAsText, isWordFile, isPDFFile, isMarkdownFile, isTextFile } from './utils';
import * as mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export interface ReadingParseResult {
  markdown: string;
  error?: string;
}

/**
 * Chuyển đổi HTML từ DOCX sang Markdown sạch (dùng mammoth với style map)
 */
async function parseDocxToMarkdown(file: File): Promise<string> {
  const arrayBuffer = await readFileAsArrayBuffer(file);
  // Cấu hình mammoth để giữ cấu trúc heading, list, link, table...
  const options = {
    styleMap: [
      "p[style-name='Heading 1'] => h1:fresh",
      "p[style-name='Heading 2'] => h2:fresh",
      "p[style-name='Heading 3'] => h3:fresh",
      "r => span",
    ],
  };
  const result = await mammoth.convertToHtml({ arrayBuffer }, options);
  let html = result.value;

  // Chuyển HTML cơ bản sang Markdown (giữ lại cấu trúc quan trọng)
  let markdown = html
    // Headings
    .replace(/<h1>(.*?)<\/h1>/gi, '# $1\n\n')
    .replace(/<h2>(.*?)<\/h2>/gi, '## $1\n\n')
    .replace(/<h3>(.*?)<\/h3>/gi, '### $1\n\n')
    // Paragraphs
    .replace(/<p>(.*?)<\/p>/gi, '$1\n\n')
    // Lists
    .replace(/<ul>(.*?)<\/ul>/gis, (_, content) => {
      return content.replace(/<li>(.*?)<\/li>/gi, '- $1\n') + '\n';
    })
    .replace(/<ol>(.*?)<\/ol>/gis, (_, content) => {
      let i = 1;
      return content.replace(/<li>(.*?)<\/li>/gi, () => `${i++}. $1\n`) + '\n';
    })
    // Bold, italic
    .replace(/<strong>(.*?)<\/strong>/gi, '**$1**')
    .replace(/<em>(.*?)<\/em>/gi, '*$1*')
    // Links
    .replace(/<a href="(.*?)">(.*?)<\/a>/gi, '[$2]($1)')
    // Line breaks
    .replace(/<br\s*\/?>/gi, '\n')
    // Remove remaining HTML tags
    .replace(/<[^>]+>/g, '')
    // Clean multiple newlines
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return markdown;
}

/**
 * Parse PDF → text (có thể wrap vào code block nếu muốn giữ định dạng)
 */
async function parsePDFToText(file: File): Promise<string> {
  const arrayBuffer = await readFileAsArrayBuffer(file);
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  let fullText = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item: any) => item.str).join(' ');
    fullText += pageText + '\n\n';
  }
  return fullText.trim();
}

async function parseMarkdownOrText(file: File): Promise<string> {
  return await readFileAsText(file);
}

export async function parseReadingFile(file: File): Promise<ReadingParseResult> {
  try {
    let markdown = '';
    if (isWordFile(file)) {
      markdown = await parseDocxToMarkdown(file);
    } else if (isPDFFile(file)) {
      const text = await parsePDFToText(file);
      // Giữ nguyên text, có thể bọc trong markdown code block để giữ nguyên khoảng trắng?
      markdown = text;
    } else if (isMarkdownFile(file) || isTextFile(file)) {
      markdown = await parseMarkdownOrText(file);
    } else {
      return { markdown: '', error: 'Unsupported file format. Please upload .docx, .pdf, .md, or .txt' };
    }
    if (!markdown.trim()) {
      return { markdown: '', error: 'File is empty or could not extract content' };
    }
    return { markdown };
  } catch (err: any) {
    console.error('Reading parse error:', err);
    return { markdown: '', error: err.message || 'Failed to parse file' };
  }
}