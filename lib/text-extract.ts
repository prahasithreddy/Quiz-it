import type { Readable } from "node:stream";
import mammoth from "mammoth";
import { logger } from "./logger";

export async function extractTextFromPdf(arrayBuffer: ArrayBuffer): Promise<string> {
  logger.info({ 
    bufferSize: arrayBuffer.byteLength,
    fileType: 'PDF'
  }, "Starting PDF text extraction");

  try {
    // Use pdf-parse for PDF text extraction
    const { pdf } = await import("pdf-parse");
    logger.debug("Successfully imported pdf-parse library");

    const buffer = Buffer.from(arrayBuffer);
    logger.debug({ 
      bufferLength: buffer.length,
      firstBytes: buffer.slice(0, 10).toString('hex')
    }, "Created buffer from ArrayBuffer");

    // pdf-parse is optimized for server-side usage by default
    // No configuration options needed - it automatically handles server-side optimization
    const result = await pdf(buffer);
    
    logger.info({ 
      extractedTextLength: result.text?.length || 0,
      hasText: !!result.text,
      numPages: (result as any).numpages || 'unknown',
      info: (result as any).info || 'no info available'
    }, "PDF parsing completed successfully");

    if (!result.text || result.text.trim().length === 0) {
      logger.warn("PDF extraction resulted in empty text");
    }

    const normalizedText = normalizeText(result.text as string);
    logger.info({ 
      originalLength: result.text?.length || 0,
      normalizedLength: normalizedText.length
    }, "Text normalization completed");

    return normalizedText;
  } catch (error) {
    logger.error({ 
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      bufferSize: arrayBuffer.byteLength
    }, "PDF text extraction failed");
    throw error;
  }
}

export async function extractTextFromDocx(arrayBuffer: ArrayBuffer): Promise<string> {
  logger.info({ 
    bufferSize: arrayBuffer.byteLength,
    fileType: 'DOCX'
  }, "Starting DOCX text extraction");

  try {
    const buffer = Buffer.from(arrayBuffer);
    logger.debug({ 
      bufferLength: buffer.length,
      firstBytes: buffer.slice(0, 10).toString('hex')
    }, "Created buffer from ArrayBuffer");

    const { value } = await mammoth.extractRawText({ buffer });
    logger.info({ 
      extractedTextLength: value?.length || 0,
      hasText: !!value
    }, "DOCX parsing completed successfully");

    if (!value || value.trim().length === 0) {
      logger.warn("DOCX extraction resulted in empty text");
    }

    const normalizedText = normalizeText(value || "");
    logger.info({ 
      originalLength: value?.length || 0,
      normalizedLength: normalizedText.length
    }, "Text normalization completed");

    return normalizedText;
  } catch (error) {
    logger.error({ 
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      bufferSize: arrayBuffer.byteLength
    }, "DOCX text extraction failed");
    throw error;
  }
}

export function normalizeText(input: string): string {
  logger.debug({ 
    inputLength: input.length,
    hasControlChars: /[\u0000-\u001F\u007F]/.test(input),
    hasHyphenBreaks: /\s+-\n\s*/.test(input),
    hasMultipleSpaces: /\s{2,}/.test(input)
  }, "Starting text normalization");

  const normalized = input
    .replace(/[\u0000-\u001F\u007F]+/g, " ")
    .replace(/\s+-\n\s*/g, "")
    .replace(/\s+/g, " ")
    .trim();

  logger.debug({ 
    originalLength: input.length,
    normalizedLength: normalized.length,
    reduction: input.length - normalized.length
  }, "Text normalization completed");

  return normalized;
}

export async function arrayBufferFromReadable(stream: Readable): Promise<ArrayBuffer> {
  logger.info("Starting stream to ArrayBuffer conversion");
  
  const chunks: Buffer[] = [];
  let chunkCount = 0;
  let totalBytes = 0;

  try {
    for await (const chunk of stream) {
      chunkCount++;
      const bufferChunk = typeof chunk === "string" ? Buffer.from(chunk) : chunk as Buffer;
      chunks.push(bufferChunk);
      totalBytes += bufferChunk.length;
      
      logger.debug({ 
        chunkNumber: chunkCount,
        chunkSize: bufferChunk.length,
        totalBytesSoFar: totalBytes
      }, "Processed stream chunk");
    }

    const finalBuffer = Buffer.concat(chunks);
    logger.info({ 
      totalChunks: chunkCount,
      totalBytes: totalBytes,
      finalBufferSize: finalBuffer.length
    }, "Stream conversion completed successfully");

    return finalBuffer.buffer;
  } catch (error) {
    logger.error({ 
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      chunksProcessed: chunkCount,
      bytesProcessed: totalBytes
    }, "Stream to ArrayBuffer conversion failed");
    throw error;
  }
}

