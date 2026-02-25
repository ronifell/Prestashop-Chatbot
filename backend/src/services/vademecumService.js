import { readFile } from 'fs/promises';
import { query } from '../config/database.js';
import logger from '../utils/logger.js';
import crypto from 'crypto';

/**
 * Vademecum Service
 * Handles PDF vademecum processing and retrieval.
 * Vademecums are technical/commercial specifications for products.
 */

/**
 * Extract text from a PDF buffer using pdf-parse
 * @param {Buffer} pdfBuffer
 * @returns {string} - Extracted text
 */
export async function extractTextFromPDF(pdfBuffer) {
  try {
    // Dynamic import for pdf-parse (CommonJS module)
    const pdfParse = (await import('pdf-parse')).default;
    const data = await pdfParse(pdfBuffer);
    return data.text || '';
  } catch (error) {
    logger.error('PDF text extraction failed', { error: error.message });
    return '';
  }
}

/**
 * Split text into manageable chunks for context window
 * @param {string} text - Full text
 * @param {number} maxChunkSize - Max characters per chunk (default 2000)
 * @returns {string[]}
 */
export function splitIntoChunks(text, maxChunkSize = 2000) {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const chunks = [];
  let currentChunk = '';

  for (const sentence of sentences) {
    if ((currentChunk + sentence).length > maxChunkSize && currentChunk) {
      chunks.push(currentChunk.trim());
      currentChunk = '';
    }
    currentChunk += sentence + ' ';
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

/**
 * Store a vademecum PDF in the database
 * @param {string} filePath - Path to PDF file (or Buffer directly)
 * @param {string} originalName - Original filename
 * @param {boolean} storeBinary - Whether to store the PDF binary in database (default: true)
 * @returns {Object} - Stored vademecum record
 */
export async function storeVademecum(filePath, originalName, storeBinary = true) {
  // Support both file path (string) and buffer input
  const pdfBuffer = Buffer.isBuffer(filePath) ? filePath : await readFile(filePath);
  const fileHash = crypto.createHash('sha256').update(pdfBuffer).digest('hex');
  const fileSize = pdfBuffer.length;

  // Check for duplicate
  const existing = await query(
    'SELECT id FROM vademecums WHERE file_hash = $1',
    [fileHash]
  );

  if (existing.rows.length > 0) {
    logger.info('Vademecum already exists (duplicate hash)', { filename: originalName });
    return { id: existing.rows[0].id, duplicate: true };
  }

  const text = await extractTextFromPDF(pdfBuffer);
  const chunks = splitIntoChunks(text);

  // Store PDF binary in database if requested
  if (storeBinary) {
    const result = await query(
      `INSERT INTO vademecums (filename, original_name, content_text, content_chunks, file_hash, file_data, file_size, mime_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [filePath, originalName, text, JSON.stringify(chunks), fileHash, pdfBuffer, fileSize, 'application/pdf']
    );

    logger.info('Vademecum stored with binary data', { 
      id: result.rows[0].id, 
      filename: originalName, 
      chunks: chunks.length,
      fileSize: `${(fileSize / 1024).toFixed(2)} KB`
    });
    return { id: result.rows[0].id, duplicate: false, chunksCount: chunks.length, fileSize };
  } else {
    // Legacy behavior: store only text (no binary)
    const result = await query(
      `INSERT INTO vademecums (filename, original_name, content_text, content_chunks, file_hash, file_size, mime_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [filePath, originalName, text, JSON.stringify(chunks), fileHash, fileSize, 'application/pdf']
    );

    logger.info('Vademecum stored (text only)', { 
      id: result.rows[0].id, 
      filename: originalName, 
      chunks: chunks.length 
    });
    return { id: result.rows[0].id, duplicate: false, chunksCount: chunks.length, fileSize };
  }
}

/**
 * Search vademecum content by keywords
 * @param {string} searchTerms
 * @param {number} limit
 * @returns {Array} - Relevant vademecum chunks
 */
export async function searchVademecums(searchTerms, limit = 3) {
  try {
    const result = await query(
      `SELECT id, original_name, content_text
       FROM vademecums
       WHERE is_active = true
         AND LOWER(content_text) LIKE $1
       LIMIT $2`,
      [`%${searchTerms.toLowerCase()}%`, limit]
    );

    // Extract relevant chunks from matching vademecums
    const relevantChunks = [];
    for (const row of result.rows) {
      const chunks = splitIntoChunks(row.content_text, 1500);
      const matchingChunks = chunks.filter(chunk =>
        chunk.toLowerCase().includes(searchTerms.toLowerCase())
      );
      if (matchingChunks.length > 0) {
        relevantChunks.push({
          vademecumId: row.id,
          name: row.original_name,
          content: matchingChunks[0], // Take first matching chunk
        });
      }
    }

    return relevantChunks;
  } catch (error) {
    logger.error('Vademecum search error', { error: error.message });
    return [];
  }
}

/**
 * Get all vademecum records (metadata only, excludes binary data)
 */
export async function listVademecums() {
  const result = await query(
    `SELECT id, original_name, file_hash, file_size, mime_type, is_active, created_at 
     FROM vademecums 
     ORDER BY created_at DESC`
  );
  return result.rows;
}

/**
 * Get PDF binary data by ID
 * @param {number} vademecumId - ID of the vademecum
 * @returns {Object|null} - PDF buffer and metadata, or null if not found
 */
export async function getVademecumPDF(vademecumId) {
  try {
    const result = await query(
      `SELECT file_data, original_name, mime_type, file_size 
       FROM vademecums 
       WHERE id = $1 AND file_data IS NOT NULL`,
      [vademecumId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      buffer: row.file_data, // This is already a Buffer from PostgreSQL
      filename: row.original_name,
      mimeType: row.mime_type || 'application/pdf',
      size: row.file_size
    };
  } catch (error) {
    logger.error('Error retrieving PDF from database', { error: error.message, vademecumId });
    return null;
  }
}

/**
 * Check if a vademecum has binary data stored
 * @param {number} vademecumId - ID of the vademecum
 * @returns {boolean}
 */
export async function hasPDFBinary(vademecumId) {
  const result = await query(
    'SELECT 1 FROM vademecums WHERE id = $1 AND file_data IS NOT NULL',
    [vademecumId]
  );
  return result.rows.length > 0;
}
