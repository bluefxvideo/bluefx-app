'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Download, Eye, Clock, History } from 'lucide-react';

/**
 * History Output - Shows generation history in right panel
 * Displays past generations with actions and details
 */
export function HistoryOutput() {
  const [selectedHistory, setSelectedHistory] = useState<string | null>(null);

  // Mock data - in real implementation, this would come from the database
  const mockHistory = [
    {
      id: '1',
      prompt: 'Epic gaming moment with shocked expression, bright colors, dramatic lighting',
      type: 'thumbnail',
      thumbnails: [
        '/api/placeholder/400/225?text=Thumbnail+1',
        '/api/placeholder/400/225?text=Thumbnail+2',
        '/api/placeholder/400/225?text=Thumbnail+3',
        '/api/placeholder/400/225?text=Thumbnail+4'
      ],
      createdAt: '2025-01-15T10:30:00Z',
      credits: 8,
      status: 'completed'
    },
    {
      id: '2', 
      prompt: 'Professional business presentation thumbnail',
      type: 'face-swap',
      thumbnails: [
        '/api/placeholder/400/225?text=Face+Swap+1',
        '/api/placeholder/400/225?text=Face+Swap+2'
      ],
      createdAt: '2025-01-14T15:45:00Z',
      credits: 10,
      status: 'completed'
    },
    {
      id: '3',
      prompt: 'Cooking tutorial chocolate cake recipe',
      type: 'recreate',
      thumbnails: [
        '/api/placeholder/400/225?text=Recipe+1',
        '/api/placeholder/400/225?text=Recipe+2',
        '/api/placeholder/400/225?text=Recipe+3',
        '/api/placeholder/400/225?text=Recipe+4'
      ],
      createdAt: '2025-01-14T12:20:00Z',
      credits: 8,
      status: 'completed'
    },
    {
      id: '4',
      prompt: 'Tech review iPhone 15 Pro Max',
      type: 'titles',
      titles: [
        'iPhone 15 Pro Max Review: The TRUTH About Apple\'s Flagship!',
        'I Used iPhone 15 Pro Max for 30 Days... Here\'s What Happened',
        'iPhone 15 Pro Max vs Competition: Which Should You Buy?',
        'The iPhone 15 Pro Max Feature Apple Doesn\'t Want You to Know'
      ],
      createdAt: '2025-01-13T09:15:00Z',
      credits: 1,
      status: 'completed'
    }
  ];

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'thumbnail': return 'bg-blue-100 text-blue-600';
      case 'face-swap': return 'bg-blue-100 text-blue-700';
      case 'recreate': return 'bg-blue-100 text-blue-600';
      case 'titles': return 'bg-yellow-100 text-yellow-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 24) {
      return `${diffInHours}h ago`;
    } else {
      const diffInDays = Math.floor(diffInHours / 24);
      return `${diffInDays}d ago`;
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header removed - title is handled by OutputPanelShell */}

      {/* History Grid - match Thumbnail Machine columns and tones */}
      <div className="flex-1 overflow-y-auto scrollbar-hover">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {mockHistory.map((item) => (
            <Card 
              key={item.id} 
              className={`p-3 bg-secondary transition-all duration-200 hover:shadow-md cursor-pointer ${
                selectedHistory === item.id ? 'ring-2 ring-primary' : ''
              }`}
              onClick={() => setSelectedHistory(selectedHistory === item.id ? null : item.id)}
            >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Badge className={`text-sm ${getTypeColor(item.type)}`}>
                  {item.type.replace('-', ' ')}
                </Badge>
                <span className="text-sm text-muted-foreground">{item.credits}c</span>
              </div>
              <p className="font-medium text-base leading-tight line-clamp-2">{item.prompt}</p>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Clock className="w-3 h-3" />
                <span>{formatDate(item.createdAt)}</span>
              </div>
              {item.type === 'titles' ? (
                <div className="bg-muted/50 p-2 rounded">
                  <p className="text-base line-clamp-2">{item.titles?.[0]}</p>
                  {(item.titles?.length || 0) > 1 && (
                    <p className="text-sm text-muted-foreground mt-1">+{(item.titles?.length || 0) - 1} more</p>
                  )}
                </div>
              ) : (
                <div className="aspect-video bg-muted rounded overflow-hidden">
                  <div className="w-full h-full bg-gradient-to-br from-muted to-muted-foreground/20 flex items-center justify-center">
                    <span className="text-base text-muted-foreground">{item.thumbnails?.length || 0} images</span>
                  </div>
                </div>
              )}
              {selectedHistory === item.id && (
                <div className="pt-2 border-t space-y-2">
                  <div className="text-sm text-muted-foreground">
                    {item.type === 'titles' ? `${item.titles?.length || 0} titles` : `${item.thumbnails?.length || 0} images`}
                  </div>
                  <div className="flex flex-col gap-1">
                    <Button variant="ghost" size="sm" className="h-6 px-2 justify-start">
                      <Eye className="w-3 h-3 mr-1" />
                      <span className="text-sm">View</span>
                    </Button>
                    <Button variant="ghost" size="sm" className="h-6 px-2 justify-start">
                      <Download className="w-3 h-3 mr-1" />
                      <span className="text-sm">Download</span>
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </Card>
        ))}
        </div>
      </div>

      {/* Summary Footer */}
      <Card className="mt-4 p-3 bg-secondary">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-lg font-semibold text-primary">{mockHistory.length}</p>
            <p className="text-sm text-muted-foreground">Generations</p>
          </div>
          <div>
            <p className="text-lg font-semibold">{mockHistory.reduce((acc, item) => acc + item.credits, 0)}</p>
            <p className="text-sm text-muted-foreground">Credits Used</p>
          </div>
          <div>
            <p className="text-lg font-semibold">{mockHistory.reduce((acc, item) => acc + (item.thumbnails?.length || 0), 0)}</p>
            <p className="text-sm text-muted-foreground">Assets Created</p>
          </div>
        </div>
      </Card>
    </div>
  );
}