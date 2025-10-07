import type { Readable } from "node:stream";
import mammoth from "mammoth";
import { logger } from "./logger";

export interface ExtractedContent {
  text: string;
  metadata: {
    wordCount: number;
    pageCount?: number;
    hasImages: boolean;
    hasStructure: boolean;
    language?: string;
    quality: 'high' | 'medium' | 'low';
    warnings: string[];
  };
  sections: {
    title?: string;
    content: string;
    type: 'heading' | 'paragraph' | 'list' | 'table' | 'unknown';
    confidence: number;
  }[];
}

export async function extractTextFromPdf(arrayBuffer: ArrayBuffer): Promise<ExtractedContent> {
  logger.info({ 
    bufferSize: arrayBuffer.byteLength,
    fileType: 'PDF'
  }, "Starting enhanced PDF text extraction");

  try {
    // Use pdf-parse for PDF text extraction
    const { pdf } = await import("pdf-parse");
    const buffer = Buffer.from(arrayBuffer);
    
    // Configure pdf-parse for better text extraction
    const result = await pdf(buffer, {
      // Normalize whitespace and improve text extraction
      normalizeWhitespace: true,
      disableCombineTextItems: false,
    });
    
    logger.info({ 
      extractedTextLength: result.text?.length || 0,
      hasText: !!result.text,
      numPages: (result as any).numpages || 0,
    }, "PDF parsing completed");

    if (!result.text || result.text.trim().length === 0) {
      logger.warn("PDF extraction resulted in empty text");
      return {
        text: "",
        metadata: {
          wordCount: 0,
          pageCount: (result as any).numpages || 0,
          hasImages: false,
          hasStructure: false,
          quality: 'low',
          warnings: ['No extractable text found', 'Document may be scanned or image-based']
        },
        sections: []
      };
    }

    return analyzeAndStructureContent(result.text, {
      pageCount: (result as any).numpages || 0,
      sourceType: 'pdf'
    });

  } catch (error) {
    logger.error({ 
      error: error instanceof Error ? error.message : String(error),
      bufferSize: arrayBuffer.byteLength
    }, "PDF text extraction failed");
    throw new Error(`PDF extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function extractTextFromDocx(arrayBuffer: ArrayBuffer): Promise<ExtractedContent> {
  logger.info({ 
    bufferSize: arrayBuffer.byteLength,
    fileType: 'DOCX'
  }, "Starting enhanced DOCX text extraction");

  try {
    const buffer = Buffer.from(arrayBuffer);
    
    // Extract both raw text and HTML to preserve structure
    const [rawResult, htmlResult] = await Promise.all([
      mammoth.extractRawText({ buffer }),
      mammoth.convertToHtml({ buffer })
    ]);

    logger.info({ 
      rawTextLength: rawResult.value?.length || 0,
      htmlLength: htmlResult.value?.length || 0,
      hasRawText: !!rawResult.value,
      hasHtml: !!htmlResult.value
    }, "DOCX parsing completed");

    if (!rawResult.value || rawResult.value.trim().length === 0) {
      logger.warn("DOCX extraction resulted in empty text");
      return {
        text: "",
        metadata: {
          wordCount: 0,
          hasImages: false,
          hasStructure: false,
          quality: 'low',
          warnings: ['No extractable text found', 'Document may be corrupted or password-protected']
        },
        sections: []
      };
    }

    // Use HTML version to detect structure if available
    const content = analyzeAndStructureContent(rawResult.value, {
      sourceType: 'docx',
      htmlContent: htmlResult.value
    });

    // Check for any mammoth warnings
    if (rawResult.messages.length > 0 || htmlResult.messages.length > 0) {
      const warnings = [...rawResult.messages, ...htmlResult.messages]
        .map(msg => msg.message)
        .filter(Boolean);
      content.metadata.warnings.push(...warnings);
    }

    return content;

  } catch (error) {
    logger.error({ 
      error: error instanceof Error ? error.message : String(error),
      bufferSize: arrayBuffer.byteLength
    }, "DOCX text extraction failed");
    throw new Error(`DOCX extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function analyzeAndStructureContent(
  text: string, 
  options: { 
    pageCount?: number; 
    sourceType: 'pdf' | 'docx'; 
    htmlContent?: string 
  }
): ExtractedContent {
  
  const cleanedText = smartNormalizeText(text);
  const wordCount = countWords(cleanedText);
  
  // Analyze content structure
  const sections = detectSections(cleanedText, options.htmlContent);
  const metadata = analyzeContentQuality(cleanedText, sections, options);

  logger.info({
    originalLength: text.length,
    cleanedLength: cleanedText.length,
    wordCount,
    sectionsFound: sections.length,
    quality: metadata.quality
  }, "Content analysis completed");

  return {
    text: cleanedText,
    metadata: {
      ...metadata,
      wordCount,
      pageCount: options.pageCount
    },
    sections
  };
}

function smartNormalizeText(input: string): string {
  return input
    // Remove excessive whitespace but preserve paragraph breaks
    .replace(/[ \t]+/g, ' ')
    // Normalize line breaks - preserve double breaks for paragraphs
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // Remove more than 2 consecutive newlines
    .replace(/\n{3,}/g, '\n\n')
    // Fix hyphenated words at line breaks
    .replace(/(\w+)-\s*\n\s*(\w+)/g, '$1$2')
    // Remove control characters except newlines and tabs
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim();
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(word => word.length > 0).length;
}

function detectSections(text: string, htmlContent?: string): ExtractedContent['sections'] {
  const sections: ExtractedContent['sections'] = [];
  
  // Split text into potential sections
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  
  for (let i = 0; i < paragraphs.length; i++) {
    const paragraph = paragraphs[i].trim();
    if (paragraph.length < 10) continue; // Skip very short paragraphs
    
    const section = {
      content: paragraph,
      type: classifyContentType(paragraph),
      confidence: calculateConfidence(paragraph)
    } as ExtractedContent['sections'][0];
    
    // Try to detect if this is a heading
    if (isLikelyHeading(paragraph)) {
      section.title = paragraph;
      section.type = 'heading';
      section.confidence = Math.min(section.confidence + 0.2, 1.0);
    }
    
    sections.push(section);
  }
  
  return sections;
}

function classifyContentType(text: string): ExtractedContent['sections'][0]['type'] {
  // Classify content based on patterns
  if (isLikelyHeading(text)) return 'heading';
  if (isLikelyList(text)) return 'list';
  if (isLikelyTable(text)) return 'table';
  if (text.length > 50 && text.includes('.')) return 'paragraph';
  return 'unknown';
}

function isLikelyHeading(text: string): boolean {
  const trimmed = text.trim();
  return (
    trimmed.length < 100 && 
    !trimmed.endsWith('.') &&
    !trimmed.endsWith(',') &&
    (
      /^[A-Z][^.]*$/.test(trimmed) || // All caps or sentence case without period
      /^\d+\.?\s+[A-Z]/.test(trimmed) || // Numbered heading
      /^[A-Z\s]{3,}$/.test(trimmed) // ALL CAPS
    )
  );
}

function isLikelyList(text: string): boolean {
  const lines = text.split('\n');
  const listIndicators = lines.filter(line => 
    /^\s*[•\-\*\d+\.)\]]\s/.test(line) || 
    /^\s*[a-z]\)\s/.test(line)
  );
  return listIndicators.length >= 2 || listIndicators.length / lines.length > 0.5;
}

function isLikelyTable(text: string): boolean {
  const lines = text.split('\n');
  const tableIndicators = lines.filter(line =>
    (line.includes('|') && line.split('|').length > 2) ||
    (line.includes('\t') && line.split('\t').length > 2)
  );
  return tableIndicators.length >= 2;
}

function calculateConfidence(text: string): number {
  let confidence = 0.5; // Base confidence
  
  // Increase confidence for well-formed sentences
  if (text.includes('.') && text.length > 20) confidence += 0.2;
  
  // Increase confidence for proper capitalization
  if (/^[A-Z]/.test(text)) confidence += 0.1;
  
  // Decrease confidence for very short or very long blocks
  if (text.length < 20) confidence -= 0.2;
  if (text.length > 2000) confidence -= 0.1;
  
  // Increase confidence for structured content
  if (text.includes(':') || text.includes(';')) confidence += 0.1;
  
  return Math.max(0, Math.min(1, confidence));
}

function analyzeContentQuality(
  text: string, 
  sections: ExtractedContent['sections'],
  options: { sourceType: 'pdf' | 'docx'; pageCount?: number }
): Pick<ExtractedContent['metadata'], 'hasImages' | 'hasStructure' | 'language' | 'quality' | 'warnings'> {
  
  const warnings: string[] = [];
  const wordCount = countWords(text);
  
  // Detect language (simple heuristic)
  const language = detectLanguage(text);
  
  // Check for structure
  const hasStructure = sections.some(s => s.type === 'heading') || 
                      sections.length > 3;
  
  // Estimate quality
  let quality: 'high' | 'medium' | 'low' = 'high';
  
  if (wordCount < 100) {
    quality = 'low';
    warnings.push('Document contains very little text (less than 100 words)');
  } else if (wordCount < 300) {
    quality = 'medium';
    warnings.push('Document contains limited text (less than 300 words)');
  }
  
  // Check for potential OCR issues in PDFs
  if (options.sourceType === 'pdf') {
    const ocrIssues = detectOCRIssues(text);
    if (ocrIssues.length > 0) {
      quality = quality === 'high' ? 'medium' : 'low';
      warnings.push(...ocrIssues);
    }
  }
  
  // Check text coherence
  if (!hasGoodCoherence(text)) {
    quality = quality === 'high' ? 'medium' : 'low';
    warnings.push('Text appears fragmented or poorly structured');
  }
  
  return {
    hasImages: false, // We don't extract images yet
    hasStructure,
    language,
    quality,
    warnings
  };
}

function detectLanguage(text: string): string {
  // Simple language detection - could be enhanced with a proper language detection library
  const sample = text.slice(0, 1000).toLowerCase();
  
  // Common English words
  const englishWords = ['the', 'and', 'that', 'have', 'for', 'not', 'with', 'you', 'this', 'but'];
  const englishCount = englishWords.reduce((count, word) => 
    count + (sample.split(word).length - 1), 0);
  
  return englishCount > 5 ? 'en' : 'unknown';
}

function detectOCRIssues(text: string): string[] {
  const issues: string[] = [];
  
  // Check for common OCR artifacts
  if (/[il1]{3,}/.test(text)) {
    issues.push('Possible OCR confusion between letters and numbers');
  }
  
  if (/\w[.,;:]\w/.test(text)) {
    issues.push('Possible missing spaces after punctuation');
  }
  
  if ((text.match(/[A-Z]{2,}/g) || []).length > text.length / 100) {
    issues.push('Excessive uppercase text may indicate OCR issues');
  }
  
  return issues;
}

function hasGoodCoherence(text: string): boolean {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
  if (sentences.length < 3) return true; // Too short to judge
  
  // Check average sentence length
  const avgLength = sentences.reduce((sum, s) => sum + s.length, 0) / sentences.length;
  if (avgLength < 20 || avgLength > 200) return false;
  
  // Check for repeated phrases (could indicate extraction issues)
  const phrases = sentences.map(s => s.trim().toLowerCase());
  const uniquePhrases = new Set(phrases);
  if (uniquePhrases.size / phrases.length < 0.7) return false;
  
  return true;
}

export async function arrayBufferFromReadable(stream: Readable): Promise<ArrayBuffer> {
  logger.info("Starting stream to ArrayBuffer conversion");
  
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  try {
    for await (const chunk of stream) {
      const bufferChunk = typeof chunk === "string" ? Buffer.from(chunk) : chunk as Buffer;
      chunks.push(bufferChunk);
      totalBytes += bufferChunk.length;
    }

    const finalBuffer = Buffer.concat(chunks);
    logger.info({ 
      totalBytes,
      finalBufferSize: finalBuffer.length
    }, "Stream conversion completed successfully");

    return finalBuffer.buffer;
  } catch (error) {
    logger.error({ 
      error: error instanceof Error ? error.message : String(error),
      bytesProcessed: totalBytes
    }, "Stream to ArrayBuffer conversion failed");
    throw error;
  }
}