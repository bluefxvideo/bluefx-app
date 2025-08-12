'use client';

import Image from 'next/image';
import { 
  Play, 
  Scissors, 
  Plus, 
  Trash2, 
  RotateCcw,
  Settings,
  Edit3,
  Image as ImageIcon,
  Volume2,
  GripVertical
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useVideoEditorStore } from '../store/video-editor-store';
import { TimelineSyncIndicator } from '../components/timeline-sync-indicator';
import { useState } from 'react';

interface VideoEditorPanelProps {
  onEdit: (editData: unknown) => void;
  isEditing: boolean;
  currentComposition?: unknown;
  credits: number;
}

export function VideoEditorPanel({ onEdit, isEditing: _isEditing, currentComposition: _currentComposition, credits: _credits }: VideoEditorPanelProps) {
  // Local dialog state
  const [_addSegmentDialogOpen, _setAddSegmentDialogOpen] = useState(false);
  const [_addSegmentAfter, _setAddSegmentAfter] = useState<string | undefined>();
  
  // Drag and drop state
  const [draggedSegment, setDraggedSegment] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  
  // Text editing state
  const [editingSegmentId, setEditingSegmentId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');

  // Get state and actions from Zustand store
  const {
    // State
    segments,
    timeline,
    settings,
    // Actions
    setActiveTab,
    updateTypography,
    updateColors,
    setZoom,
    selectSegment,
    regenerateAsset,
    deleteSegment,
    addSegment: _addSegment,
    addEmptySegment,
    splitSegment,
    reorderSegments,
    showToast,
    updateSegmentText: _updateSegmentText
  } = useVideoEditorStore();

  // Separate subscription for UI state to ensure reactivity
  const ui = useVideoEditorStore((state) => state.ui);
  

  const _handleSegmentSelect = (segmentId: string, multi = false) => {
    selectSegment(segmentId, multi);
  };

  const _handleSegmentEdit = async (segmentId: string, action: string) => {
    if (action === 'regenerate_image') {
      await regenerateAsset(segmentId, 'image');
    } else if (action === 'remove_segment') {
      await deleteSegment(segmentId);
    } else {
      // Pass through to parent for other actions
      const editData = {
        edit_type: action,
        edit_data: { segment_id: segmentId }
      };
      onEdit(editData);
    }
  };

  const handleFontFamilyChange = (value: string) => {
    updateTypography({ font_family: value });
  };

  const handleTextAlignmentChange = (alignment: 'left' | 'center' | 'right') => {
    updateTypography({ text_align: alignment });
  };

  const handleColorChange = (colorType: 'text' | 'highlight', color: string) => {
    if (colorType === 'text') {
      updateColors({ text_color: color });
    } else {
      updateColors({ highlight_color: color });
    }
  };

  const handleZoomChange = (value: number[]) => {
    setZoom(value[0]);
  };

  const handleAIAction = async (action: string) => {
    if (action === 'regenerate_segment' && timeline.selected_segment_ids.length > 0) {
      await regenerateAsset(timeline.selected_segment_ids[0], 'image');
    } else if (action === 'add_segment') {
      // Add empty segment immediately at first position
      addEmptySegment();
    } else if (action === 'split_at_playhead') {
      const currentSegment = segments.find(s => 
        s.start_time <= timeline.current_time && s.end_time >= timeline.current_time
      );
      if (currentSegment) {
        splitSegment(currentSegment.id, timeline.current_time);
      } else {
        showToast('No segment found at current playhead position', 'warning');
      }
    }
  };

  // Always show editor settings - like Blotato's left panel
  return (
    <div className="h-full flex flex-col space-y-4 py-6 overflow-y-auto scrollbar-hover">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center">
            <Edit3 className="w-4 h-4 text-white" />
          </div>
          <h2 className="text-xl font-semibold">Timeline Editor</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Professional video editing with AI assistance
        </p>
      </div>

      {/* Timeline Sync Status - Subtle indicator */}
      <TimelineSyncIndicator />
      
      {/* Settings/Segments Tabs - Card Style */}
          <div className="flex bg-muted/50 rounded-lg p-1 border border-border/30">
            <Button 
              variant="ghost" 
              size="sm" 
              className={`flex-1 transition-all font-medium ${
                ui.panels.left_panel.active_tab === 'settings' 
                  ? 'bg-background shadow-sm border border-border/70 text-primary' 
                  : 'hover:bg-background/60 text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setActiveTab('settings')}
            >
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className={`flex-1 transition-all font-medium ${
                ui.panels.left_panel.active_tab === 'segments' 
                  ? 'bg-background shadow-sm border border-border/70 text-primary' 
                  : 'hover:bg-background/60 text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setActiveTab('segments')}
            >
              <ImageIcon className="w-4 h-4 mr-2" />
              Segments
            </Button>
          </div>

      {/* Settings Tab Content */}
      {ui.panels.left_panel.active_tab === 'settings' && (
        <>
          {/* Typography Section - Like Blotato */}
          <Card>
            <CardContent className="p-4 space-y-4">
              <h3 className="font-medium">Typography</h3>
          
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">Font Family</Label>
              <Select value={settings.typography.font_family} onValueChange={handleFontFamilyChange}>
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Inter">Inter (Sans-serif)</SelectItem>
                  <SelectItem value="Roboto">Roboto</SelectItem>
                  <SelectItem value="Arial">Arial</SelectItem>
                  <SelectItem value="Helvetica">Helvetica</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Alignment</Label>
              <div className="flex gap-1 mt-1">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className={`flex-1 h-8 ${settings.typography.text_align === 'left' ? 'bg-muted' : ''}`}
                  onClick={() => handleTextAlignmentChange('left')}
                >
                  <div className="w-3 h-2 bg-current opacity-60" style={{ clipPath: 'polygon(0 0, 80% 0, 80% 40%, 100% 40%, 100% 100%, 0 100%)' }} />
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className={`flex-1 h-8 ${settings.typography.text_align === 'center' ? 'bg-muted' : ''}`}
                  onClick={() => handleTextAlignmentChange('center')}
                >
                  <div className="w-3 h-2 bg-current opacity-60" style={{ clipPath: 'polygon(10% 0, 90% 0, 90% 40%, 100% 40%, 100% 100%, 0 100%, 0 40%, 10% 40%)' }} />
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className={`flex-1 h-8 ${settings.typography.text_align === 'right' ? 'bg-muted' : ''}`}
                  onClick={() => handleTextAlignmentChange('right')}
                >
                  <div className="w-3 h-2 bg-current opacity-60" style={{ clipPath: 'polygon(20% 0, 100% 0, 100% 100%, 0 100%, 0 40%, 20% 40%)' }} />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Colors Section - Like Blotato */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <h3 className="font-medium">Colors</h3>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Text Color</Label>
              <div className="flex gap-2 mt-1">
                <div 
                  className={`w-8 h-8 bg-white border-2 rounded cursor-pointer ${
                    settings.colors.text_color === '#ffffff' ? 'border-blue-400' : 'border-gray-200'
                  }`}
                  onClick={() => handleColorChange('text', '#ffffff')}
                />
                <div 
                  className={`w-8 h-8 bg-black border-2 rounded cursor-pointer ${
                    settings.colors.text_color === '#000000' ? 'border-blue-400' : 'border-gray-200'
                  }`}
                  onClick={() => handleColorChange('text', '#000000')}
                />
                <div 
                  className={`w-8 h-8 bg-blue-500 border-2 rounded cursor-pointer ${
                    settings.colors.text_color === '#3b82f6' ? 'border-blue-400' : 'border-gray-200'
                  }`}
                  onClick={() => handleColorChange('text', '#3b82f6')}
                />
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Highlight</Label>
              <div className="flex gap-2 mt-1">
                <div 
                  className={`w-8 h-8 bg-red-500 rounded cursor-pointer border-2 ${
                    settings.colors.highlight_color === '#ef4444' ? 'border-red-300' : 'border-gray-200'
                  }`}
                  onClick={() => handleColorChange('highlight', '#ef4444')}
                />
                <div 
                  className={`w-8 h-8 bg-yellow-400 rounded cursor-pointer border-2 ${
                    settings.colors.highlight_color === '#facc15' ? 'border-yellow-300' : 'border-gray-200'
                  }`}
                  onClick={() => handleColorChange('highlight', '#facc15')}
                />
                <div 
                  className={`w-8 h-8 bg-blue-100 rounded cursor-pointer border-2 ${
                    settings.colors.highlight_color === '#22c55e' ? 'border-green-300' : 'border-gray-200'
                  }`}
                  onClick={() => handleColorChange('highlight', '#22c55e')}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Timeline Settings */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <h3 className="font-medium">Timeline Settings</h3>
          
          <div className="space-y-3">
            <div>
              <div className="flex justify-between mb-1">
                <Label className="text-xs text-muted-foreground">Zoom</Label>
                <span className="text-xs text-muted-foreground">{Math.round(timeline.zoom_level * 100)}%</span>
              </div>
              <Slider
                value={[timeline.zoom_level]}
                onValueChange={handleZoomChange}
                min={0.5}
                max={3}
                step={0.1}
                className="w-full"
              />
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Rows</Label>
              <div className="flex items-center justify-between mt-1">
                <Button variant="outline" size="sm" className="h-6 w-6 p-0">-</Button>
                <span className="text-sm">5/8</span>
                <Button variant="outline" size="sm" className="h-6 w-6 p-0">+</Button>
              </div>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Aspect Ratio</Label>
              <div className="flex gap-1 mt-1">
                <Button variant="outline" size="sm" className="flex-1 h-7 text-xs">16:9</Button>
                <Button variant="default" size="sm" className="flex-1 h-7 text-xs bg-blue-600">9:16</Button>
                <Button variant="outline" size="sm" className="flex-1 h-7 text-xs">4:5</Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Actions */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="font-medium">AI Actions</h3>
          
          <div className="space-y-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full justify-start h-8"
              onClick={() => handleAIAction('regenerate_segment')}
              disabled={timeline.selected_segment_ids.length === 0}
            >
              <RotateCcw className="w-3 h-3 mr-2" />
              Regenerate Segment
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full justify-start h-8"
              onClick={() => handleAIAction('add_segment')}
            >
              <Plus className="w-3 h-3 mr-2" />
              Add Segment
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full justify-start h-8"
              onClick={() => handleAIAction('split_at_playhead')}
            >
              <Scissors className="w-3 h-3 mr-2" />
              Split at Playhead
            </Button>
          </div>
        </CardContent>
      </Card>
        </>
      )}

      {/* Segments Tab Content */}
      {ui.panels.left_panel.active_tab === 'segments' && (
        <>
          {/* Segments Grid */}
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">Segment Images</h3>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{segments.length} segments</span>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="h-6 px-2 text-xs"
                    onClick={() => {
                      // Add empty segment immediately at first position
                      addEmptySegment();
                    }}
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Add
                  </Button>
                </div>
              </div>
              
              
              
              <div className="grid grid-cols-2 gap-3">
                {(() => {
                  // Find the currently playing segment index using realigned timing (only one should be playing)
                  // This ensures left panel highlighting matches image/caption timing
                  const playingSegmentIndex = timeline.is_playing ? 
                    segments.findIndex(seg => 
                      timeline.current_time >= seg.start_time && 
                      timeline.current_time < seg.end_time
                    ) : -1;
                  
                  // Debug: log segment timing issues
                  if (timeline.is_playing && playingSegmentIndex === -1) {
                    console.log('🔍 No playing segment found for time:', timeline.current_time, 'segments:', segments.map(s => `${s.start_time}-${s.end_time}`));
                  }
                  
                  return segments.map((segment, i) => {
                    const isSelected = timeline.selected_segment_ids.includes(segment.id);
                    // Only the first matching segment should show as playing
                    const isCurrentlyPlaying = timeline.is_playing && i === playingSegmentIndex;
                    const isDragging = draggedSegment === segment.id;
                    const isDragOver = dragOverIndex === i;
                    const needsVoice = timeline.segments_needing_voice.includes(segment.id);
                    const hasVoiceIssue = segment.assets.voice.status === 'pending' || needsVoice;
                  
                  return (
                    <div
                      key={segment.id}
                      draggable
                      className={`relative group cursor-move rounded-lg overflow-hidden border-2 transition-all ${
                        isDragging 
                          ? 'opacity-50 scale-95 rotate-3 z-50' 
                          : isDragOver
                          ? 'scale-105 border-green-500 ring-2 ring-green-200'
                          : hasVoiceIssue
                          ? 'border-orange-300 ring-1 ring-orange-200 hover:scale-105'
                          : isSelected 
                          ? 'border-blue-500 ring-2 ring-blue-200 hover:scale-105' 
                          : isCurrentlyPlaying 
                          ? 'border-yellow-500 ring-2 ring-yellow-200 hover:scale-105' 
                          : 'border-border hover:border-primary/50 hover:scale-105'
                      }`}
                      onClick={() => !isDragging && selectSegment(segment.id)}
                      onDragStart={(e) => {
                        setDraggedSegment(segment.id);
                        e.dataTransfer.effectAllowed = 'move';
                        e.dataTransfer.setData('text/plain', segment.id);
                      }}
                      onDragEnd={() => {
                        setDraggedSegment(null);
                        setDragOverIndex(null);
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                        setDragOverIndex(i);
                      }}
                      onDragLeave={(e) => {
                        // Only clear if leaving the entire card, not just a child element
                        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                          setDragOverIndex(null);
                        }
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        const draggedId = e.dataTransfer.getData('text/plain');
                        const draggedIndex = segments.findIndex(s => s.id === draggedId);
                        
                        if (draggedIndex !== -1 && draggedIndex !== i) {
                          reorderSegments(draggedIndex, i);
                        }
                        
                        setDraggedSegment(null);
                        setDragOverIndex(null);
                      }}
                    >
                      {/* Segment Image */}
                      <div className="relative aspect-square bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900">
                        {segment.assets.image.url ? (
                          <Image
                            src={segment.assets.image.url}
                            alt={`Segment ${i + 1}`}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                            <ImageIcon className="w-8 h-8" />
                          </div>
                        )}
                        
                        {/* Overlay */}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="secondary"
                              className="h-8 w-8 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                _setEditingSegmentId(segment.id);
                                _setEditingText(segment.text);
                                // Scroll to bottom
                                setTimeout(() => {
                                  window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                                }, 100);
                              }}
                              title="Edit Text"
                            >
                              <Edit3 className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              className="h-8 w-8 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                regenerateAsset(segment.id, 'image');
                              }}
                            >
                              <RotateCcw className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="h-8 w-8 p-0"
                              onClick={async (e) => {
                                e.stopPropagation();
                                await deleteSegment(segment.id);
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                      
                      {/* Segment Info */}
                      <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white p-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium">#{i + 1}</span>
                          <span>{segment.status === 'ready' ? 'Ready' : 'Draft'}</span>
                        </div>
                        <div className="text-xs opacity-75 truncate mt-1">
                          {segment.duration ? `${segment.duration.toFixed(1)}s` : '0s'} • {segment.text ? segment.text.substring(0, 30) : ''}...
                        </div>
                      </div>
                      
                      {/* Drag Handle - shown on hover */}
                      <div className="absolute bottom-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="bg-black/50 rounded p-1 cursor-move">
                          <GripVertical className="w-3 h-3 text-white" />
                        </div>
                      </div>
                      
                      {/* Selection indicator */}
                      {isSelected && (
                        <div className="absolute top-2 right-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                          <span className="text-white text-xs font-bold">✓</span>
                        </div>
                      )}
                      
                      {/* Voice sync indicator */}
                      {hasVoiceIssue && (
                        <div className="absolute top-2 left-2 w-5 h-5 bg-orange-500/90 rounded-full flex items-center justify-center">
                          <Volume2 className="w-2.5 h-2.5 text-white" />
                        </div>
                      )}
                      
                      {/* Playing indicator */}
                      {isCurrentlyPlaying && !hasVoiceIssue && (
                        <div className="absolute top-2 left-2 w-6 h-6 bg-yellow-500 rounded-full flex items-center justify-center">
                          <Play className="w-3 h-3 text-black fill-current" />
                        </div>
                      )}
                    </div>
                  );
                  });
                })()}
              </div>
            </CardContent>
          </Card>

          {/* Selected Segment Details */}
          {timeline.selected_segment_ids.length === 1 && (
            <Card>
              <CardContent className="p-4 space-y-4">
                <h3 className="font-medium">Segment Details</h3>
                {(() => {
                  const selectedSegment = segments.find(s => timeline.selected_segment_ids.includes(s.id));
                  if (!selectedSegment) return null;
                  
                  return (
                    <div className="space-y-3">
                      <div>
                        <Label className="text-xs text-muted-foreground">Text Content</Label>
                        {editingSegmentId === selectedSegment.id ? (
                          <div className="mt-1 space-y-2">
                            <textarea
                              value={editingText}
                              onChange={(e) => setEditingText(e.target.value)}
                              className="w-full min-h-[60px] p-2 text-sm bg-background border rounded resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                              autoFocus
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="default"
                                onClick={async () => {
                                  // Save the edited text
                                  await _updateSegmentText(selectedSegment.id, editingText);
                                  setEditingSegmentId(null);
                                  showToast('Text updated', 'success');
                                }}
                                className="h-7"
                              >
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setEditingSegmentId(null);
                                  setEditingText('');
                                }}
                                className="h-7"
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div 
                            className="text-sm mt-1 p-2 bg-muted rounded text-muted-foreground cursor-pointer hover:bg-muted/80 transition-colors"
                            onClick={() => {
                              setEditingSegmentId(selectedSegment.id);
                              setEditingText(selectedSegment.text);
                            }}
                          >
                            {selectedSegment.text}
                            <div className="text-xs text-muted-foreground/60 mt-1">
                              Click to edit
                            </div>
                          </div>
                        )}
                      </div>
                      
                      <div>
                        <Label className="text-xs text-muted-foreground">Image Prompt</Label>
                        <p className="text-sm mt-1 p-2 bg-muted rounded text-muted-foreground">
                          {selectedSegment.assets.image.prompt || 'Auto-generated from text'}
                        </p>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-3 text-sm">
                        <div>
                          <Label className="text-xs text-muted-foreground">Start</Label>
                          <p className="font-medium">{selectedSegment.start_time?.toFixed(1) || '0.0'}s</p>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Duration</Label>
                          <p className="font-medium">{selectedSegment.duration?.toFixed(1) || '0.0'}s</p>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">End</Label>
                          <p className="font-medium">{selectedSegment.end_time?.toFixed(1) || '0.0'}s</p>
                        </div>
                      </div>
                      
                      <div className="flex gap-2 pt-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="flex-1"
                          onClick={() => regenerateAsset(selectedSegment.id, 'image')}
                        >
                          <RotateCcw className="w-4 h-4 mr-1" />
                          Regenerate
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="flex-1"
                          onClick={() => {
                            // Scroll to text editor
                            setEditingSegmentId(selectedSegment.id);
                            setEditingText(selectedSegment.text);
                          }}
                        >
                          <Edit3 className="w-4 h-4 mr-1" />
                          Edit Text
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="flex-1"
                          onClick={() => {
                            const midPoint = selectedSegment.start_time + (selectedSegment.duration / 2);
                            splitSegment(selectedSegment.id, midPoint);
                            showToast('Segment split', 'success');
                          }}
                        >
                          <Scissors className="w-3 h-3 mr-1" />
                          Split
                        </Button>
                      </div>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          )}

          {/* Multi-Selection Actions */}
          {timeline.selected_segment_ids.length > 1 && (
            <Card>
              <CardContent className="p-4 space-y-4">
                <h3 className="font-medium">Bulk Actions</h3>
                <p className="text-sm text-muted-foreground">
                  {timeline.selected_segment_ids.length} segments selected
                </p>
                
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      timeline.selected_segment_ids.forEach(id => regenerateAsset(id, 'image'));
                    }}
                  >
                    <RotateCcw className="w-4 h-4 mr-1" />
                    Regenerate All
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="flex-1 text-red-600 hover:text-red-700"
                    onClick={async () => {
                      // Delete all selected segments
                      for (const id of timeline.selected_segment_ids) {
                        await deleteSegment(id);
                      }
                    }}
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Delete All
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}