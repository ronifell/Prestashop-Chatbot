# PDF Storage in Database - Guide

## Overview

The vademecum system now supports storing PDF files directly in the PostgreSQL database using the `BYTEA` data type. This allows you to:

- ✅ Store complete PDF files with images, text, and symbols
- ✅ Preserve original formatting and visual elements
- ✅ Serve PDFs directly from the database
- ✅ Maintain both extracted text (for search) and binary data (for viewing)

## Database Schema

The `vademecums` table includes:

- `file_data` (BYTEA) - Binary PDF file data
- `file_size` (INTEGER) - Size of PDF in bytes
- `mime_type` (VARCHAR) - File type (usually 'application/pdf')
- `content_text` (TEXT) - Extracted text for search
- `content_chunks` (JSONB) - Text chunks for AI context

## Migration

To add PDF binary storage to an existing database:

```bash
# Run the migration script
psql -U postgres -d mundomascotix_chatbot -f backend/src/db/migrations/add_pdf_binary_to_vademecums.sql
```

Or manually:

```sql
ALTER TABLE vademecums ADD COLUMN IF NOT EXISTS file_data BYTEA;
ALTER TABLE vademecums ADD COLUMN IF NOT EXISTS file_size INTEGER;
ALTER TABLE vademecums ADD COLUMN IF NOT EXISTS mime_type VARCHAR(100) DEFAULT 'application/pdf';
```

## Usage

### Importing PDFs (stores binary by default)

```bash
# Via API
curl -X POST http://localhost:3001/api/import/vademecums \
  -F "files=@vademecum1.pdf" \
  -F "files=@vademecum2.pdf"

# Via CLI script
npm run import:vademecums -- path/to/pdfs/
```

### Listing Vademecums

```bash
GET /api/admin/vademecums
```

Returns metadata (no binary data) including:
- `id`, `original_name`, `file_hash`, `file_size`, `mime_type`, `is_active`, `created_at`

### Downloading/Serving PDFs

```bash
GET /api/admin/vademecums/:id/pdf
```

Returns the actual PDF file with proper headers for viewing/downloading.

Example:
```javascript
// In browser or download tool
fetch('http://localhost:3001/api/admin/vademecums/1/pdf')
  .then(res => res.blob())
  .then(blob => {
    const url = URL.createObjectURL(blob);
    window.open(url); // Opens PDF in browser
  });
```

### Managing Vademecums

```bash
# Activate/Deactivate
PUT /api/admin/vademecums/:id
Body: { "is_active": false }

# Soft delete (deactivate)
DELETE /api/admin/vademecums/:id

# Hard delete (permanent)
DELETE /api/admin/vademecums/:id?hard=true
```

## Storage Considerations

### Advantages

1. **Centralized Storage**: All data in one place (database)
2. **Backup**: PDFs included in database backups
3. **No File System Dependencies**: Works in containerized/cloud environments
4. **Transaction Safety**: PDF storage is transactional
5. **Access Control**: Can be managed via database permissions

### Disadvantages

1. **Database Size**: PDFs increase database size significantly
2. **Performance**: Large PDFs can slow down queries (use `SELECT` without `file_data` for lists)
3. **Backup Time**: Larger backups take longer
4. **Memory**: Loading large PDFs into memory

### Recommendations

- **Small to Medium PDFs (< 10MB)**: Store in database ✅
- **Large PDFs (> 10MB)**: Consider file system storage with database reference
- **Hybrid Approach**: Store metadata + small preview in DB, full PDF on file system

## Code Examples

### Storing PDF with Binary

```javascript
import { storeVademecum } from './services/vademecumService.js';

// Store with binary (default)
await storeVademecum('/path/to/file.pdf', 'vademecum.pdf', true);

// Store without binary (text only)
await storeVademecum('/path/to/file.pdf', 'vademecum.pdf', false);
```

### Retrieving PDF

```javascript
import { getVademecumPDF } from './services/vademecumService.js';

const pdfData = await getVademecumPDF(1);
if (pdfData) {
  // pdfData.buffer - Buffer containing PDF
  // pdfData.filename - Original filename
  // pdfData.mimeType - MIME type
  // pdfData.size - File size in bytes
}
```

## Current Implementation

The system stores PDFs in the database by default when importing. The extracted text is still used for:
- Full-text search
- AI context (chunks)
- Keyword matching

The binary PDF is used for:
- Serving original files to users
- Preserving images and formatting
- Download/view functionality

## Notes

- PDFs with images, text, and symbols are fully supported
- The `pdf-parse` library extracts text, but images/symbols are preserved in the binary
- Duplicate detection uses SHA-256 hash (prevents re-importing identical files)
- File size is tracked for monitoring and optimization
