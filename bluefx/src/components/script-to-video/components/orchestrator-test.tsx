'use client';

import { Button } from "@/components/ui/button";
import { useVideoEditorStore } from "../store/video-editor-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

/**
 * Test component to verify orchestrator integration
 * This can be used to test the three-orchestrator system in development
 */
export function OrchestratorTest() {
  const { 
    segments, 
    addSegment, 
    deleteSegment, 
    regenerateAsset,
    ui,
    showToast 
  } = useVideoEditorStore();

  const testAddSegment = async () => {
    try {
      showToast('Testing segment addition with AI analysis...', 'info');
      await addSegment(undefined, 'This is a test segment that will trigger AI impact analysis.');
    } catch (error) {
      console.error('Test add segment failed:', error);
      showToast('Test failed', 'error');
    }
  };

  const testDeleteSegment = async () => {
    if (segments.length === 0) {
      showToast('No segments to delete', 'warning');
      return;
    }
    
    try {
      showToast('Testing segment deletion with AI analysis...', 'info');
      await deleteSegment(segments[0].id);
    } catch (error) {
      console.error('Test delete segment failed:', error);
      showToast('Test failed', 'error');
    }
  };

  const testRegenerateAsset = async () => {
    if (segments.length === 0) {
      showToast('No segments to regenerate', 'warning');
      return;
    }
    
    try {
      showToast('Testing asset regeneration with orchestrator...', 'info');
      await regenerateAsset(segments[0].id, 'image', 'A beautiful sunset landscape');
    } catch (error) {
      console.error('Test regenerate asset failed:', error);
      showToast('Test failed', 'error');
    }
  };

  const activeOperations = Object.keys(ui.progress.operations).length;
  const hasUserChoice = ui.modals.user_choice.open;

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Three-Orchestrator System Test
          <Badge variant="outline" className="text-xs font-mono">
            Development Tool
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* System Status */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">{segments.length}</div>
            <div className="text-xs text-muted-foreground">Segments</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-500">{activeOperations}</div>
            <div className="text-xs text-muted-foreground">Active Operations</div>
          </div>
          <div className="text-center">
            <div className={`text-2xl font-bold ${hasUserChoice ? 'text-orange-500' : 'text-gray-400'}`}>
              {hasUserChoice ? '1' : '0'}
            </div>
            <div className="text-xs text-muted-foreground">User Choices</div>
          </div>
        </div>

        {/* Test Operations */}
        <div className="space-y-3">
          <div>
            <h4 className="font-medium mb-2">Edit Orchestrator Tests</h4>
            <div className="flex gap-2">
              <Button onClick={testAddSegment} size="sm" variant="outline">
                Test Add Segment
              </Button>
              <Button 
                onClick={testDeleteSegment} 
                size="sm" 
                variant="outline"
                disabled={segments.length === 0}
              >
                Test Delete Segment
              </Button>
              <Button 
                onClick={testRegenerateAsset} 
                size="sm" 
                variant="outline"
                disabled={segments.length === 0}
              >
                Test Regenerate Asset
              </Button>
            </div>
          </div>
        </div>

        {/* Active Operations Display */}
        {activeOperations > 0 && (
          <div className="border rounded-lg p-3">
            <h4 className="font-medium mb-2 text-sm">Active Operations</h4>
            <div className="space-y-2">
              {Object.entries(ui.progress.operations).map(([id, operation]) => (
                <div key={id} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {operation.type.replace('_', ' ')}
                    </Badge>
                    <span className="text-muted-foreground">{operation.stage}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-16 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                      <div 
                        className="bg-primary h-1.5 rounded-full transition-all"
                        style={{ width: `${operation.progress}%` }}
                      />
                    </div>
                    <span className="font-mono">{operation.progress}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="text-xs text-muted-foreground p-3 bg-muted/50 rounded-lg">
          <strong>Test Instructions:</strong>
          <ul className="mt-1 space-y-1 list-disc list-inside">
            <li>Add Segment: Tests AI impact analysis and user choice dialog</li>
            <li>Delete Segment: Tests removal analysis with narrative gap detection</li>
            <li>Regenerate Asset: Tests single asset regeneration with progress tracking</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}