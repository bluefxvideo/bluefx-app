'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { BookOpen, ArrowRight, Lightbulb } from 'lucide-react';
import { useEbookWriterStore } from '../store/ebook-writer-store';
import { TabContentWrapper, TabBody, TabFooter } from '@/components/tools/tab-content-wrapper';
import { StandardStep } from '@/components/tools/standard-step';
import { DocumentUpload } from '../components/document-upload';
import type { UploadedDocument } from '@/actions/tools/ebook-document-handler';

interface TopicTabProps {
  currentTopic: string;
  isGenerating: boolean;
}

export function TopicTab({ currentTopic, isGenerating }: TopicTabProps) {
  const router = useRouter();
  const [topic, setTopic] = useState(currentTopic);
  const [description, setDescription] = useState('');
  const [uploadedDocuments, setUploadedDocuments] = useState<UploadedDocument[]>([]);
  const [isGeneratingTitles, setIsGeneratingTitles] = useState(false);
  const { setTopic: updateTopic, generateTitles, setActiveTab, setUploadedDocuments: storeDocuments } = useEbookWriterStore();
  
  // Update local state immediately, but only update store on blur/submit
  const handleTopicChange = (value: string) => {
    setTopic(value);
    // Don't update store immediately to prevent clearing title_options on keystroke
  };

  const handleSubmit = () => {
    if (!topic.trim()) return;
    
    // Update topic in store
    updateTopic(topic.trim());
    
    // Store uploaded documents if any
    if (uploadedDocuments.length > 0) {
      storeDocuments(uploadedDocuments);
    }
    
    // Navigate immediately to title tab
    setActiveTab('title');
    router.push('/dashboard/ebook-writer/title');
    
    // Titles will be generated automatically when title tab loads
  };

  const handleDocumentsChange = (docs: UploadedDocument[]) => {
    setUploadedDocuments(docs);
    storeDocuments(docs); // Update store immediately for live preview
  };

  return (
    <TabContentWrapper>
      <TabBody>
        <StandardStep
          stepNumber={1}
          title="Choose Your Topic"
          description="Start by defining what your ebook will be about"
        >
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="topic">Main Topic</Label>
              <Input
                id="topic"
                value={topic}
                onChange={(e) => handleTopicChange(e.target.value)}
                onBlur={(e) => updateTopic(e.target.value)} // Update store when user finishes editing
                placeholder="e.g., Digital Marketing for Small Businesses"
                className="text-base"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">Additional Context (Optional)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Provide any specific focus areas, target audience, or requirements..."
                rows={3}
                className="text-sm resize-y"
              />
            </div>
          </div>
        </StandardStep>

        <StandardStep
          stepNumber={2}
          title="Upload Reference Materials (Optional)"
          description="Add PDFs, Word docs, or text files to provide context for your ebook"
        >
          <DocumentUpload
            onDocumentsChange={handleDocumentsChange}
            existingDocuments={uploadedDocuments}
          />
        </StandardStep>

      </TabBody>
      
      <TabFooter>
        <Button 
          onClick={handleSubmit}
          disabled={!topic.trim() || isGenerating || isGeneratingTitles}
          className="w-full bg-primary hover:from-blue-600 hover:to-cyan-600"
        >
          {isGeneratingTitles ? (
            'Generating Titles...'
          ) : isGenerating ? (
            'Processing...'
          ) : (
            <>
              Continue to Title Generation
              <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </TabFooter>
    </TabContentWrapper>
  );
}