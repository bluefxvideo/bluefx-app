-- Create storage bucket for ebook documents if not exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents', 
  false, -- Private bucket
  52428800, -- 50MB limit
  ARRAY['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'text/markdown']
)
ON CONFLICT (id) DO NOTHING;

-- Create ebook_documents table for storing document metadata
CREATE TABLE IF NOT EXISTS public.ebook_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ebook_id UUID REFERENCES public.ebooks(id) ON DELETE SET NULL, -- Optional link to specific ebook
  storage_path TEXT NOT NULL, -- Path in Supabase storage
  filename TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('pdf', 'docx', 'txt', 'markdown')),
  content TEXT, -- Extracted text content
  token_count INTEGER,
  file_size_mb DECIMAL(10, 2),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX idx_ebook_documents_user_id ON public.ebook_documents(user_id);
CREATE INDEX idx_ebook_documents_ebook_id ON public.ebook_documents(ebook_id);
CREATE INDEX idx_ebook_documents_created_at ON public.ebook_documents(created_at DESC);

-- Add RLS policies
ALTER TABLE public.ebook_documents ENABLE ROW LEVEL SECURITY;

-- Users can only see their own documents
CREATE POLICY "Users can view own documents" ON public.ebook_documents
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own documents
CREATE POLICY "Users can insert own documents" ON public.ebook_documents
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own documents
CREATE POLICY "Users can update own documents" ON public.ebook_documents
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own documents
CREATE POLICY "Users can delete own documents" ON public.ebook_documents
  FOR DELETE USING (auth.uid() = user_id);

-- Add columns to ebooks table for document context
ALTER TABLE public.ebooks 
ADD COLUMN IF NOT EXISTS context_instructions TEXT,
ADD COLUMN IF NOT EXISTS used_gemini BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS total_context_tokens INTEGER,
ADD COLUMN IF NOT EXISTS document_ids UUID[] DEFAULT '{}';

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER update_ebook_documents_updated_at
  BEFORE UPDATE ON public.ebook_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Storage policies for documents bucket
CREATE POLICY "Users can upload own documents" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'documents' AND 
    (storage.foldername(name))[1] = 'ebook-documents' AND
    (storage.foldername(name))[2] = auth.uid()::text
  );

CREATE POLICY "Users can view own documents" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'documents' AND 
    (storage.foldername(name))[1] = 'ebook-documents' AND
    (storage.foldername(name))[2] = auth.uid()::text
  );

CREATE POLICY "Users can delete own documents" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'documents' AND 
    (storage.foldername(name))[1] = 'ebook-documents' AND
    (storage.foldername(name))[2] = auth.uid()::text
  );