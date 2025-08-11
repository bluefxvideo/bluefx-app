'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { BookOpen, ArrowRight, Lightbulb } from 'lucide-react';
import { useEbookWriterStore } from '../store/ebook-writer-store';
import { TabContentWrapper, TabBody, TabFooter } from '@/components/tools/tab-content-wrapper';
import { StandardStep } from '@/components/tools/standard-step';

interface TopicTabProps {
  currentTopic: string;
  isGenerating: boolean;
  error?: string;
}

export function TopicTab({ currentTopic, isGenerating, error }: TopicTabProps) {
  const [topic, setTopic] = useState(currentTopic);
  const [description, setDescription] = useState('');
  const { setTopic: updateTopic, generateTitles, setActiveTab } = useEbookWriterStore();

  const handleSubmit = async () => {
    if (!topic.trim()) return;
    
    // Update topic in store
    updateTopic(topic.trim());
    
    // Navigate to title tab
    setActiveTab('title');
    
    // Automatically start generating titles
    await generateTitles(topic.trim());
  };

  const topicSuggestions = [
    'Digital Marketing for Beginners',
    'Personal Finance and Investing',
    'Healthy Cooking on a Budget',
    'Remote Work Productivity',
    'Starting an Online Business',
    'Mindfulness and Mental Health',
    'Web Development Fundamentals',
    'Sustainable Living Guide',
  ];

  return (
    <TabContentWrapper>
      <TabBody>
        <StandardStep
          stepNumber={1}
          title="Choose Your Topic"
          description="Start by defining what your ebook will be about"
        >
          <Card className="bg-gray-50 dark:bg-gray-800/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-emerald-500" />
                Choose Your Ebook Topic
              </CardTitle>
              <CardDescription>
                What would you like to write about? Be specific to get better results.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="topic">Main Topic</Label>
                <Input
                  id="topic"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
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
              
              {error && (
                <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                  {error}
                </div>
              )}
            </CardContent>
          </Card>
        </StandardStep>

        <StandardStep
          stepNumber={2}
          title="Topic Ideas"
          description="Need inspiration? Try one of these popular topics"
        >
          <Card className="bg-gray-50 dark:bg-gray-800/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Lightbulb className="h-5 w-5 text-yellow-500" />
                Topic Ideas
              </CardTitle>
              <CardDescription>
                Need inspiration? Try one of these popular topics:
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-2">
                {topicSuggestions.map((suggestion, index) => (
                  <Button
                    key={index}
                    variant="ghost"
                    className="justify-start text-left h-auto p-3 hover:bg-muted"
                    onClick={() => setTopic(suggestion)}
                  >
                    <div>
                      <div className="font-medium">{suggestion}</div>
                    </div>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </StandardStep>
      </TabBody>
      
      <TabFooter>
        <Button 
          onClick={handleSubmit}
          disabled={!topic.trim() || isGenerating}
          className="w-full bg-primary hover:from-blue-600 hover:to-cyan-600"
        >
          {isGenerating ? (
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