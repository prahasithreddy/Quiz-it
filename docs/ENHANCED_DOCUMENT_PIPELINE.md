# Enhanced Document Scanning and Quiz Generation Pipeline

## Overview

The document scanning and quiz generation system has been completely rewritten to provide significantly improved accuracy, reliability, and user experience. This enhanced pipeline uses intelligent content analysis, structure-aware chunking, and advanced quiz generation techniques.

## Key Improvements

### 1. Enhanced Text Extraction (`lib/text-extract.ts`)

**Before:**
- Basic text extraction with simple normalization
- No content quality analysis
- Limited error handling
- Lost document structure information

**After:**
- **Structured Content Analysis**: Detects headings, paragraphs, lists, and tables
- **Quality Assessment**: Evaluates content quality (high/medium/low) with specific warnings
- **Intelligent Normalization**: Preserves important formatting while cleaning artifacts
- **OCR Issue Detection**: Identifies and reports potential scanning problems
- **Comprehensive Metadata**: Word count, language detection, coherence analysis

```typescript
interface ExtractedContent {
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
  sections: Array<{
    title?: string;
    content: string;
    type: 'heading' | 'paragraph' | 'list' | 'table' | 'unknown';
    confidence: number;
  }>;
}
```

### 2. Intelligent Content Chunking (`lib/chunking.ts`)

**Before:**
- Simple paragraph-based splitting
- Fixed chunk sizes without content awareness
- No content importance ranking
- Limited to first few chunks only

**After:**
- **Structure-Aware Chunking**: Respects document hierarchy and content relationships
- **Importance Ranking**: Prioritizes high-quality, information-rich content sections
- **Semantic Overlap**: Maintains context between chunks with intelligent overlapping
- **Content Type Detection**: Handles different content types (headings, lists, tables) appropriately
- **Quality Filtering**: Removes low-quality chunks when sufficient high-quality content exists

```typescript
interface ContentChunk {
  id: string;
  content: string;
  metadata: {
    tokenCount: number;
    wordCount: number;
    type: 'heading' | 'paragraph' | 'list' | 'table' | 'mixed';
    importance: number; // 0-1 scale
    topics: string[];
    context?: string;
  };
  sourceSection?: {
    title?: string;
    type: string;
    confidence: number;
  };
}
```

### 3. Advanced Quiz Generation (`lib/quiz/generate.ts`)

**Before:**
- Generic prompts with limited context
- Used only first 6 chunks regardless of quality
- Basic validation with generic fallbacks
- No content analysis before generation

**After:**
- **Content-Aware Selection**: Chooses optimal chunks based on importance and diversity
- **Enhanced Prompting**: Uses detailed content analysis and structure information
- **Quality Validation**: Comprehensive validation with intelligent error correction
- **Metadata Tracking**: Provides detailed generation statistics and source quality information
- **Adaptive Question Count**: Adjusts question distribution based on content availability

### 4. Robust API Endpoint (`app/api/ingest/route.ts`)

**Before:**
- Basic error handling
- Limited feedback to users
- Simple validation

**After:**
- **Enhanced Error Handling**: Specific error messages with actionable feedback
- **Content Quality Reporting**: Detailed analysis of document suitability
- **Processing Metadata**: Comprehensive information about generation process
- **Validation Pipeline**: Multi-stage validation with detailed error reporting

## Usage Examples

### Basic Document Processing

```typescript
import { extractTextFromPdf, extractTextFromDocx } from '@/lib/text-extract';
import { intelligentChunking } from '@/lib/chunking';
import { generateQuizFromExtractedContent } from '@/lib/quiz/generate';

// Extract content with structure analysis
const extractedContent = await extractTextFromPdf(fileBuffer);

// Create intelligent chunks
const chunks = intelligentChunking(extractedContent, {
  targetTokens: 1500,
  preserveStructure: true,
  prioritizeImportant: true
});

// Generate quiz with enhanced context
const result = await generateQuizFromExtractedContent(extractedContent, {
  numQuestions: 10,
  difficulty: 'medium',
  questionTypes: ['mcq', 'true-false']
});
```

### Content Quality Analysis

```typescript
const { metadata } = extractedContent;

console.log(`Document Quality: ${metadata.quality}`);
console.log(`Word Count: ${metadata.wordCount}`);
console.log(`Sections Found: ${extractedContent.sections.length}`);

if (metadata.warnings.length > 0) {
  console.log('Processing Warnings:', metadata.warnings);
}
```

## Quality Indicators

### Content Quality Levels

- **High Quality**: Clean, well-structured text with good coherence
- **Medium Quality**: Readable text with minor issues or limited structure
- **Low Quality**: Significant extraction issues, very short content, or poor coherence

### Common Warnings

- "Document contains very little text (less than 100 words)"
- "Possible OCR confusion between letters and numbers"
- "Text appears fragmented or poorly structured"
- "Document may be scanned or image-based"

## Configuration Options

### Chunking Options

```typescript
interface ChunkingOptions {
  targetTokens?: number;        // Default: 1500
  maxTokens?: number;          // Default: 2000
  minTokens?: number;          // Default: 300
  overlapTokens?: number;      // Default: 150
  preserveStructure?: boolean; // Default: true
  prioritizeImportant?: boolean; // Default: true
}
```

### Generation Parameters

```typescript
interface GenerationParams {
  numQuestions: number;        // 1-50
  difficulty: 'easy' | 'medium' | 'hard';
  language: string;           // Default: 'en'
  questionTypes: Array<'mcq' | 'true-false'>;
  quizName?: string;          // Optional custom name
}
```

## API Response Format

The enhanced API now returns additional metadata for better user experience:

```json
{
  "meta": {
    "title": "Generated Quiz",
    "language": "en",
    "numQuestions": 10,
    "createdAt": "2025-01-01T00:00:00Z"
  },
  "sections": [...],
  "_metadata": {
    "generation": {
      "sourceQuality": "high",
      "chunksUsed": 8,
      "totalChunks": 12,
      "processingTime": 45000,
      "contentWarnings": []
    }
  }
}
```

## Error Handling

### Common Error Scenarios and Solutions

1. **"Document contains insufficient text"**
   - Solution: Ensure document has at least 100 readable words

2. **"No readable text found"**
   - Solution: Document may be image-based; use OCR or different file format

3. **"Failed to generate quiz"**
   - Solution: Check document quality and try simpler content

4. **"Unsupported file type"**
   - Solution: Use PDF or DOCX formats only

## Performance Optimizations

1. **Intelligent Chunk Selection**: Only processes most relevant content sections
2. **Quality Filtering**: Skips low-quality content when sufficient high-quality content exists
3. **Optimized Token Usage**: More accurate token estimation reduces API costs
4. **Parallel Processing**: Multiple extraction methods run concurrently when applicable

## Migration from Legacy System

The enhanced system maintains backward compatibility through legacy function wrappers:

```typescript
// Legacy function still works
const chunks = chunkTextByParagraphs(text, 1800, 180);

// But new function provides better results
const chunks = intelligentChunking(extractedContent, options);
```

## Future Enhancements

- [ ] Image and diagram extraction
- [ ] Multi-language content detection and processing
- [ ] Advanced topic modeling for better question distribution
- [ ] Real-time content quality feedback during upload
- [ ] Support for additional file formats (PPT, TXT, etc.)

## Troubleshooting

### Low Quality Results

1. Check document source quality in metadata
2. Review content warnings for specific issues
3. Try different difficulty levels
4. Ensure document has sufficient structured content

### Processing Errors

1. Verify file format and size (max 20MB)
2. Check for password protection or encryption
3. Ensure document contains readable text (not just images)
4. Try re-saving document in a clean format

## Technical Architecture

```
Document Upload
       ↓
Enhanced Text Extraction
       ↓
Content Structure Analysis
       ↓
Intelligent Chunking
       ↓
Quality Assessment & Selection
       ↓
Context-Aware Quiz Generation
       ↓
Comprehensive Validation
       ↓
Enhanced User Feedback
```

This enhanced pipeline provides a significantly improved experience with better accuracy, more detailed feedback, and robust error handling.




