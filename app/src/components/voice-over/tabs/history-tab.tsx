'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Trash2, Download, Clock, FileAudio, History } from 'lucide-react';
import { TabContentWrapper, TabHeader, TabBody } from '@/components/tools/tab-content-wrapper';
import { VoiceOverState } from '../hooks/use-voice-over';
import { GeneratedVoice } from '@/actions/tools/voice-over';

interface HistoryTabProps {
  voiceOverState: {
    state: VoiceOverState;
    loadVoiceHistory: () => void;
    deleteVoice: (voiceId: string) => void;
  };
}

/**
 * History Tab - Voice over generation history
 * Following exact BlueFX style guide patterns
 */
export function HistoryTab({ voiceOverState }: HistoryTabProps) {
  const { state, loadVoiceHistory, deleteVoice } = voiceOverState;
  const [searchQuery, setSearchQuery] = useState('');
  const [filterVoice, setFilterVoice] = useState('all');
  const [filterFormat, setFilterFormat] = useState('all');

  // Filter history based on search and filters
  const filteredHistory = state.voiceHistory.filter((voice: GeneratedVoice) => {
    const matchesSearch = voice.script_text?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         voice.voice_name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesVoice = filterVoice === 'all' || voice.voice_id === filterVoice;
    const matchesFormat = filterFormat === 'all' || voice.export_format === filterFormat;
    
    return matchesSearch && matchesVoice && matchesFormat;
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  return (
    <TabContentWrapper>
      {/* Header */}
      <TabHeader
        icon={History}
        title="Voice History"
        description="View and manage your generated voices"
        iconGradient="from-gray-500 to-gray-600"
      />

      {/* Form Content */}
      <TabBody>
        {/* Search and Filters */}
        <div className="space-y-4">
          {/* Search */}
          <div className="space-y-2">
            <Label>Search Voices</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by script or voice name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs">Filter by Voice</Label>
              <Select value={filterVoice} onValueChange={setFilterVoice}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Voices</SelectItem>
                  <SelectItem value="alloy">Alloy</SelectItem>
                  <SelectItem value="nova">Nova</SelectItem>
                  <SelectItem value="shimmer">Shimmer</SelectItem>
                  <SelectItem value="echo">Echo</SelectItem>
                  <SelectItem value="onyx">Onyx</SelectItem>
                  <SelectItem value="fable">Fable</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Filter by Format</Label>
              <Select value={filterFormat} onValueChange={setFilterFormat}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Formats</SelectItem>
                  <SelectItem value="mp3">MP3</SelectItem>
                  <SelectItem value="wav">WAV</SelectItem>
                  <SelectItem value="ogg">OGG</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* History List */}
        <div className="space-y-3">
          {filteredHistory.length === 0 ? (
            <Card className="p-8 text-center">
              <FileAudio className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h4 className="font-medium mb-2">No voices found</h4>
              <p className="text-sm text-muted-foreground">
                {state.voiceHistory.length === 0 
                  ? "Generate your first voice to see it here"
                  : "Try adjusting your search or filters"
                }
              </p>
            </Card>
          ) : (
            filteredHistory.map((voice: GeneratedVoice) => (
              <Card key={voice.id} className="p-4 hover:shadow-md transition-shadow">
                <div className="space-y-3">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs">
                          {voice.voice_name}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {voice.export_format?.toUpperCase()}
                        </Badge>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          {formatDuration(voice.duration_seconds || 0)}
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(voice.created_at)} • {voice.file_size_mb}MB • {voice.credits_used} credits
                      </p>
                    </div>
                    
                    <div className="flex gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(voice.audio_url, '_blank')}
                      >
                        <Download className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteVoice(voice.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>

                  {/* Script Preview */}
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-sm leading-relaxed line-clamp-3">
                      {voice.script_text}
                    </p>
                  </div>

                  {/* Audio Player */}
                  <audio controls className="w-full">
                    <source src={voice.audio_url} type={`audio/${voice.export_format || 'mp3'}`} />
                    Your browser does not support the audio element.
                  </audio>
                </div>
              </Card>
            ))
          )}
        </div>

        {/* Stats Footer */}
        {state.voiceHistory.length > 0 && (
          <Card className="p-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-blue-500">
                  {state.voiceHistory.length}
                </div>
                <div className="text-xs text-muted-foreground">Total Voices</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-600">
                  {state.voiceHistory.reduce((sum: number, voice: GeneratedVoice) => sum + (voice.duration_seconds || 0), 0)}s
                </div>
                <div className="text-xs text-muted-foreground">Total Duration</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-600">
                  {state.voiceHistory.reduce((sum: number, voice: GeneratedVoice) => sum + (voice.credits_used || 0), 0)}
                </div>
                <div className="text-xs text-muted-foreground">Credits Used</div>
              </div>
            </div>
          </Card>
        )}
      </TabBody>

      {/* Refresh Button - Outside scrollable area */}
      <div className="mt-6">
        <Button
          onClick={loadVoiceHistory}
          disabled={state.isLoading}
          className="w-full h-12 bg-gradient-to-r from-gray-500 to-gray-600 hover:scale-[1.02] transition-all duration-300 font-medium"
          size="lg"
        >
        {state.isLoading ? (
          <>
            <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent" />
            Loading History...
          </>
        ) : (
          <>
            <History className="w-4 h-4 mr-2" />
            Refresh History
          </>
        )}
        </Button>
      </div>
    </TabContentWrapper>
  );
}