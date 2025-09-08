'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { BookOpen, ArrowRight, Lightbulb, Upload } from 'lucide-react';
import { useEbookWriterStore } from '../store/ebook-writer-store';
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
  
  const handleTopicChange = (value: string) => {
    setTopic(value);
  };

  const handleSubmit = () => {
    if (!topic.trim()) return;
    
    updateTopic(topic.trim());
    
    if (uploadedDocuments.length > 0) {
      storeDocuments(uploadedDocuments);
    }
    
    setActiveTab('title');
    router.push('/dashboard/ebook-writer/title');
  };

  const handleDocumentsChange = (docs: UploadedDocument[]) => {
    setUploadedDocuments(docs);
    storeDocuments(docs);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto scrollbar-hover">
        <div className="px-6 py-8">
          {/* Header */}
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold">Choose Your Topic</h2>
            <p className="text-muted-foreground mt-2">Define what your ebook will be about and provide any reference materials</p>
          </div>

          {/* Full-width two-column layout */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Left Column - Topic Definition */}
            <Card className="h-full">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold">
                    1
                  </div>
                  <div>
                    <CardTitle>Define Your Topic</CardTitle>
                    <CardDescription>Start by describing what your ebook will cover</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="topic">Main Topic *</Label>
                  <Input
                    id="topic"
                    value={topic}
                    onChange={(e) => handleTopicChange(e.target.value)}
                    onBlur={(e) => updateTopic(e.target.value)}
                    placeholder="e.g., Digital Marketing for Small Businesses"
                    className="text-base"
                  />
                  <p className="text-xs text-muted-foreground">Be specific about your ebook's main subject</p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="description">Additional Context (Optional)</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Provide any specific focus areas, target audience, or requirements..."
                    rows={6}
                    className="text-sm resize-none"
                  />
                  <p className="text-xs text-muted-foreground">Help the AI understand your vision better</p>
                </div>

                {/* Quick suggestions */}
                <div className="pt-4 border-t">
                  <p className="text-sm font-medium mb-3 flex items-center gap-2">
                    <Lightbulb className="h-4 w-4" />
                    Popular Topics
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      'AI & Machine Learning',
                      'Personal Finance',
                      'Health & Wellness',
                      'Digital Marketing',
                      'Self Improvement',
                      'Cryptocurrency'
                    ].map((suggestion) => (
                      <Button
                        key={suggestion}
                        variant="outline"
                        size="sm"
                        onClick={() => setTopic(suggestion)}
                        className="justify-start"
                      >
                        {suggestion}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Right Column - Reference Materials */}
            <Card className="h-full">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold">
                    2
                  </div>
                  <div>
                    <CardTitle>Upload Reference Materials</CardTitle>
                    <CardDescription>Add PDFs, Word docs, or text files to provide context</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <DocumentUpload
                  onDocumentsChange={handleDocumentsChange}
                  existingDocuments={uploadedDocuments}
                />
                <div className="mt-6 space-y-4">
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm font-medium mb-2">Tips for Better Results:</p>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Upload research papers or articles related to your topic</li>
                      <li>• Include notes or outlines you've already created</li>
                      <li>• Add competitor ebooks or content for inspiration</li>
                      <li>• The AI will analyze these to create more accurate content</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      
      {/* Fixed Footer */}
      <div className="border-t px-6 py-4 bg-background">
        <div className="flex justify-end">
          <Button 
            onClick={handleSubmit}
            disabled={!topic.trim() || isGenerating || isGeneratingTitles}
            className="min-w-[200px] bg-primary hover:bg-primary/90"
            size="lg"
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
        </div>
      </div>
    </div>
  );
}