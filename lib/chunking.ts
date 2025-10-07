import type { ExtractedContent } from './text-extract';

export interface ContentChunk {
  id: string;
  content: string;
  metadata: {
    tokenCount: number;
    wordCount: number;
    type: 'heading' | 'paragraph' | 'list' | 'table' | 'mixed';
    importance: number; // 0-1 scale
    topics: string[];
    context?: string; // Previous heading or context
  };
  sourceSection?: {
    title?: string;
    type: string;
    confidence: number;
  };
}

export interface ChunkingOptions {
  targetTokens?: number;
  maxTokens?: number;
  minTokens?: number;
  overlapTokens?: number;
  preserveStructure?: boolean;
  prioritizeImportant?: boolean;
}

const DEFAULT_OPTIONS: Required<ChunkingOptions> = {
  targetTokens: 1500,
  maxTokens: 2000,
  minTokens: 300,
  overlapTokens: 150,
  preserveStructure: true,
  prioritizeImportant: true
};

export function estimateTokens(text: string): number {
  // More accurate token estimation
  // Account for punctuation, whitespace, and common patterns
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const punctuation = (text.match(/[.,;:!?'"()[\]{}]/g) || []).length;
  const numbers = (text.match(/\d+/g) || []).length;
  
  // Rough heuristic: 
  // - Average word ~1.3 tokens
  // - Punctuation ~0.5 tokens each
  // - Numbers vary but average ~1 token
  return Math.ceil(words.length * 1.3 + punctuation * 0.5 + numbers);
}

export function intelligentChunking(
  extractedContent: ExtractedContent,
  options: ChunkingOptions = {}
): ContentChunk[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  console.log(`[CHUNKING] Starting intelligent chunking with ${extractedContent.sections.length} sections`);
  console.log(`[CHUNKING] Content quality: ${extractedContent.metadata.quality}, Word count: ${extractedContent.metadata.wordCount}`);

  // If content is short enough, return as single chunk
  const totalTokens = estimateTokens(extractedContent.text);
  if (totalTokens <= opts.targetTokens) {
    return [{
      id: 'chunk-0',
      content: extractedContent.text,
      metadata: {
        tokenCount: totalTokens,
        wordCount: extractedContent.metadata.wordCount,
        type: 'mixed',
        importance: 1.0,
        topics: extractTopics(extractedContent.text)
      }
    }];
  }

  if (opts.preserveStructure && extractedContent.sections.length > 0) {
    return structureAwareChunking(extractedContent, opts);
  } else {
    return semanticChunking(extractedContent.text, opts);
  }
}

function structureAwareChunking(
  extractedContent: ExtractedContent,
  options: Required<ChunkingOptions>
): ContentChunk[] {
  const chunks: ContentChunk[] = [];
  let currentChunk: string[] = [];
  let currentTokens = 0;
  let currentContext = '';
  let chunkIndex = 0;

  for (let i = 0; i < extractedContent.sections.length; i++) {
    const section = extractedContent.sections[i];
    const sectionTokens = estimateTokens(section.content);
    
    // Update context if this is a heading
    if (section.type === 'heading' && section.title) {
      currentContext = section.title;
    }
    
    // If this section alone exceeds max tokens, split it
    if (sectionTokens > options.maxTokens) {
      // Finish current chunk if it has content
      if (currentChunk.length > 0) {
        chunks.push(createChunkFromContent(
          currentChunk.join('\n\n'),
          chunkIndex++,
          currentContext,
          section
        ));
        currentChunk = [];
        currentTokens = 0;
      }
      
      // Split the large section
      const largeSectionChunks = splitLargeSection(section, options, chunkIndex, currentContext);
      chunks.push(...largeSectionChunks);
      chunkIndex += largeSectionChunks.length;
      continue;
    }
    
    // If adding this section would exceed target, finish current chunk
    if (currentTokens + sectionTokens > options.targetTokens && currentChunk.length > 0) {
      chunks.push(createChunkFromContent(
        currentChunk.join('\n\n'),
        chunkIndex++,
        currentContext,
        section
      ));
      
      // Start new chunk with overlap
      const overlapContent = createOverlap(currentChunk, options.overlapTokens);
      currentChunk = overlapContent.length > 0 ? [overlapContent] : [];
      currentTokens = overlapContent.length > 0 ? estimateTokens(overlapContent) : 0;
    }
    
    currentChunk.push(section.content);
    currentTokens += sectionTokens;
  }
  
  // Add final chunk if it has content
  if (currentChunk.length > 0) {
    chunks.push(createChunkFromContent(
      currentChunk.join('\n\n'),
      chunkIndex,
      currentContext
    ));
  }

  console.log(`[CHUNKING] Structure-aware chunking created ${chunks.length} chunks`);
  return rankAndOptimizeChunks(chunks, options);
}

function splitLargeSection(
  section: ExtractedContent['sections'][0],
  options: Required<ChunkingOptions>,
  startIndex: number,
  context: string
): ContentChunk[] {
  const chunks: ContentChunk[] = [];
  
  // Split by sentences first
  const sentences = section.content.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0);
  let currentChunk: string[] = [];
  let currentTokens = 0;
  
  for (const sentence of sentences) {
    const sentenceTokens = estimateTokens(sentence);
    
    if (currentTokens + sentenceTokens > options.targetTokens && currentChunk.length > 0) {
      chunks.push(createChunkFromContent(
        currentChunk.join(' '),
        startIndex + chunks.length,
        context,
        section
      ));
      
      // Add overlap
      const overlapSentences = currentChunk.slice(-2); // Keep last 2 sentences for overlap
      currentChunk = overlapSentences;
      currentTokens = estimateTokens(overlapSentences.join(' '));
    }
    
    currentChunk.push(sentence);
    currentTokens += sentenceTokens;
  }
  
  if (currentChunk.length > 0) {
    chunks.push(createChunkFromContent(
      currentChunk.join(' '),
      startIndex + chunks.length,
      context,
      section
    ));
  }
  
  return chunks;
}

function semanticChunking(text: string, options: Required<ChunkingOptions>): ContentChunk[] {
  const chunks: ContentChunk[] = [];
  
  // Split by paragraphs first
  let paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  
  // If paragraphs are too large, split by sentences
  const refinedParagraphs: string[] = [];
  for (const paragraph of paragraphs) {
    if (estimateTokens(paragraph) > options.maxTokens) {
      const sentences = paragraph.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 10);
      refinedParagraphs.push(...sentences);
    } else {
      refinedParagraphs.push(paragraph);
    }
  }
  
  let currentChunk: string[] = [];
  let currentTokens = 0;
  let chunkIndex = 0;
  
  for (const paragraph of refinedParagraphs) {
    const paragraphTokens = estimateTokens(paragraph);
    
    if (currentTokens + paragraphTokens > options.targetTokens && currentChunk.length > 0) {
      chunks.push(createChunkFromContent(
        currentChunk.join('\n\n'),
        chunkIndex++
      ));
      
      // Create overlap
      const overlapContent = createOverlap(currentChunk, options.overlapTokens);
      currentChunk = overlapContent.length > 0 ? [overlapContent] : [];
      currentTokens = overlapContent.length > 0 ? estimateTokens(overlapContent) : 0;
    }
    
    currentChunk.push(paragraph);
    currentTokens += paragraphTokens;
  }
  
  if (currentChunk.length > 0) {
    chunks.push(createChunkFromContent(
      currentChunk.join('\n\n'),
      chunkIndex
    ));
  }
  
  console.log(`[CHUNKING] Semantic chunking created ${chunks.length} chunks`);
  return rankAndOptimizeChunks(chunks, options);
}

function createChunkFromContent(
  content: string,
  index: number,
  context?: string,
  sourceSection?: ExtractedContent['sections'][0]
): ContentChunk {
  const tokenCount = estimateTokens(content);
  const wordCount = content.split(/\s+/).filter(w => w.length > 0).length;
  const topics = extractTopics(content);
  const importance = calculateImportance(content, topics, sourceSection);
  
  return {
    id: `chunk-${index}`,
    content,
    metadata: {
      tokenCount,
      wordCount,
      type: determineChunkType(content, sourceSection),
      importance,
      topics,
      context
    },
    sourceSection
  };
}

function createOverlap(chunks: string[], targetOverlapTokens: number): string {
  if (chunks.length === 0) return '';
  
  // Start from the end and work backwards
  let overlap = '';
  let tokens = 0;
  
  for (let i = chunks.length - 1; i >= 0 && tokens < targetOverlapTokens; i--) {
    const chunkTokens = estimateTokens(chunks[i]);
    if (tokens + chunkTokens <= targetOverlapTokens) {
      overlap = chunks[i] + (overlap ? '\n\n' + overlap : '');
      tokens += chunkTokens;
    } else {
      // Take partial content from this chunk
      const sentences = chunks[i].split(/(?<=[.!?])\s+/);
      for (let j = sentences.length - 1; j >= 0 && tokens < targetOverlapTokens; j--) {
        const sentenceTokens = estimateTokens(sentences[j]);
        if (tokens + sentenceTokens <= targetOverlapTokens) {
          overlap = sentences[j] + (overlap ? ' ' + overlap : '');
          tokens += sentenceTokens;
        }
      }
      break;
    }
  }
  
  return overlap;
}

function extractTopics(text: string): string[] {
  const topics: string[] = [];
  
  // Simple keyword extraction - could be enhanced with NLP
  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3);
  
  const wordFreq = new Map<string, number>();
  words.forEach(word => {
    wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
  });
  
  // Get most frequent meaningful words
  const sortedWords = Array.from(wordFreq.entries())
    .filter(([word, freq]) => freq > 1 && !isStopWord(word))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word);
  
  topics.push(...sortedWords);
  
  // Look for named entities (simple pattern matching)
  const entities = text.match(/\b[A-Z][a-z]+(?:\s[A-Z][a-z]+)*\b/g) || [];
  const uniqueEntities = [...new Set(entities)]
    .filter(entity => entity.length > 3 && entity.length < 30)
    .slice(0, 3);
  
  topics.push(...uniqueEntities);
  
  return [...new Set(topics)].slice(0, 8); // Max 8 topics
}

function isStopWord(word: string): boolean {
  const stopWords = new Set([
    'the', 'and', 'that', 'have', 'for', 'not', 'with', 'you', 'this', 'but',
    'his', 'from', 'they', 'she', 'her', 'been', 'than', 'its', 'now', 'find',
    'are', 'was', 'were', 'what', 'when', 'where', 'who', 'how', 'why', 'could',
    'should', 'would', 'will', 'can', 'may', 'might', 'must', 'shall', 'does',
    'did', 'has', 'had', 'having', 'being', 'very', 'more', 'most', 'other',
    'such', 'some', 'any', 'each', 'every', 'all', 'both', 'few', 'many'
  ]);
  return stopWords.has(word);
}

function calculateImportance(
  content: string,
  topics: string[],
  sourceSection?: ExtractedContent['sections'][0]
): number {
  let importance = 0.5; // Base importance
  
  // Boost for headings
  if (sourceSection?.type === 'heading') {
    importance += 0.3;
  }
  
  // Boost for high confidence sections
  if (sourceSection && sourceSection.confidence > 0.8) {
    importance += 0.2;
  }
  
  // Boost for content with many topics (indicates rich information)
  importance += Math.min(topics.length * 0.05, 0.2);
  
  // Boost for proper sentence structure
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 10);
  if (sentences.length >= 3) {
    importance += 0.1;
  }
  
  // Boost for medium-length content (not too short, not too long)
  const wordCount = content.split(/\s+/).length;
  if (wordCount >= 50 && wordCount <= 500) {
    importance += 0.1;
  }
  
  // Penalize very short content
  if (wordCount < 20) {
    importance -= 0.3;
  }
  
  return Math.max(0, Math.min(1, importance));
}

function determineChunkType(
  content: string,
  sourceSection?: ExtractedContent['sections'][0]
): ContentChunk['metadata']['type'] {
  if (sourceSection) {
    return sourceSection.type === 'unknown' ? 'paragraph' : sourceSection.type;
  }
  
  // Analyze content patterns
  if (content.length < 100 && !content.includes('.')) return 'heading';
  if (content.includes('•') || /^\s*\d+\./.test(content)) return 'list';
  if (content.includes('|') || content.includes('\t')) return 'table';
  
  return 'paragraph';
}

function rankAndOptimizeChunks(
  chunks: ContentChunk[],
  options: Required<ChunkingOptions>
): ContentChunk[] {
  // Sort by importance if prioritization is enabled
  if (options.prioritizeImportant) {
    chunks.sort((a, b) => b.metadata.importance - a.metadata.importance);
    
    console.log(`[CHUNKING] Chunks ranked by importance:`, 
      chunks.map(c => `${c.id}: ${c.metadata.importance.toFixed(2)}`).slice(0, 5)
    );
  }
  
  // MODIFIED: Keep ALL chunks to preserve complete document context
  // Only filter out truly empty or meaningless chunks
  const meaningfulChunks = chunks.filter(c => 
    c.metadata.wordCount >= 5 && // At least 5 words
    c.content.trim().length >= 20 // At least 20 characters
  );
  
  console.log(`[CHUNKING] Preserved ${meaningfulChunks.length} meaningful chunks out of ${chunks.length} total`);
  
  // Keep reasonable limit but much higher to preserve document completeness
  const maxChunks = 25; // Increased from 15 to preserve more content
  if (meaningfulChunks.length > maxChunks) {
    console.log(`[CHUNKING] Document is very large, limiting to top ${maxChunks} chunks out of ${meaningfulChunks.length}`);
    return meaningfulChunks.slice(0, maxChunks);
  }
  
  return meaningfulChunks;
}

// Legacy function for backward compatibility - converts old chunking to new format
export function chunkTextByParagraphs(
  text: string, 
  targetTokens = 1800, 
  overlapTokens = 180
): string[] {
  console.log(`[CHUNKING] Using legacy chunking method`);
  
  // Create a minimal ExtractedContent object
  const extractedContent: ExtractedContent = {
    text,
    metadata: {
      wordCount: text.split(/\s+/).length,
      hasImages: false,
      hasStructure: false,
      quality: 'medium',
      warnings: []
    },
    sections: [{ content: text, type: 'paragraph', confidence: 0.5 }]
  };
  
  const chunks = intelligentChunking(extractedContent, {
    targetTokens,
    overlapTokens,
    preserveStructure: false
  });
  
  return chunks.map(chunk => chunk.content);
}