-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Add vector column (1536 dimensions for OpenAI text-embedding-3-small)
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "embeddingVector" vector(1536);

-- Create index for fast approximate nearest neighbor search
CREATE INDEX IF NOT EXISTS document_embedding_idx 
ON "Document" 
USING ivfflat ("embeddingVector" vector_cosine_ops)
WITH (lists = 100);
