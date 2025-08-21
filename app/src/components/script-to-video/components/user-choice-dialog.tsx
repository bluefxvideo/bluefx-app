'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useVideoEditorStore } from "../store/video-editor-store";
// REMOVED: getCostPreview from deleted video-editor-actions
// import { getCostPreview } from "../../../actions/tools/video-editor-actions";
import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";

interface CostBreakdown {
  creditsRequired: number;
  estimatedTime: number;
  breakdown: Array<{ item: string; credits: number; description: string }>;
}

export function UserChoiceDialog() {
  const { ui, hideUserChoiceDialog } = useVideoEditorStore();
  const [selectedStrategy, setSelectedStrategy] = useState<string>('');
  const [costBreakdowns, setCostBreakdowns] = useState<Record<string, CostBreakdown>>({});
  const [loadingCosts, setLoadingCosts] = useState(false);

  const modal = ui.modals.user_choice;
  const { data: dialog, onConfirm, onCancel } = modal;

  // Load cost breakdowns when dialog opens
  useEffect(() => {
    if (dialog && dialog.showCostBreakdown) {
      setLoadingCosts(true);
      
      Promise.all(
        dialog.strategies.map(async (strategy) => {
          try {
            const cost = await getCostPreview(
              dialog.operation as 'add' | 'remove' | 'regenerate' | 'export',
              strategy.id,
              {} // Would pass actual composition
            );
            return { strategyId: strategy.id, cost };
          } catch (error) {
            console.error('Failed to get cost preview:', error);
            return { 
              strategyId: strategy.id, 
              cost: { 
                creditsRequired: strategy.creditsRequired, 
                estimatedTime: strategy.processingTime,
                breakdown: [{ item: 'Unknown', credits: strategy.creditsRequired, description: 'Cost estimate unavailable' }]
              }
            };
          }
        })
      ).then((results) => {
        const costMap: Record<string, CostBreakdown> = {};
        results.forEach(({ strategyId, cost }) => {
          costMap[strategyId] = cost;
        });
        setCostBreakdowns(costMap);
        setLoadingCosts(false);
      });
    }
  }, [dialog]);

  // Set default strategy
  useEffect(() => {
    if (dialog && !selectedStrategy) {
      setSelectedStrategy(dialog.defaultStrategy || dialog.strategies[0]?.id || '');
    }
  }, [dialog, selectedStrategy]);

  if (!dialog) return null;

  const handleConfirm = () => {
    if (selectedStrategy && onConfirm) {
      onConfirm(selectedStrategy);
    }
    hideUserChoiceDialog();
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    }
    hideUserChoiceDialog();
  };

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    return `${Math.round(seconds / 60)}m`;
  };

  return (
    <Dialog open={modal.open} onOpenChange={(open) => !open && handleCancel()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {dialog.title}
            <Badge variant="outline" className="text-xs">
              AI Analysis
            </Badge>
          </DialogTitle>
          <DialogDescription>
            {dialog.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            Choose how to handle this operation:
          </div>

          <div className="space-y-3">
            {dialog.strategies.map((strategy) => {
              const isSelected = selectedStrategy === strategy.id;
              const cost = costBreakdowns[strategy.id];
              
              return (
                <div
                  key={strategy.id}
                  className={`border rounded-lg p-4 cursor-pointer transition-all ${
                    isSelected 
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/10' 
                      : 'border-border hover:border-muted-foreground/50'
                  }`}
                  onClick={() => setSelectedStrategy(strategy.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded-full border-2 transition-colors ${
                          isSelected 
                            ? 'border-primary bg-primary' 
                            : 'border-muted-foreground'
                        }`}>
                          {isSelected && (
                            <div className="w-2 h-2 bg-white rounded-full m-0.5" />
                          )}
                        </div>
                        <h4 className="font-medium">{strategy.name}</h4>
                        <Badge 
                          variant={strategy.qualityImpact === 'none' ? 'secondary' : 
                                   strategy.qualityImpact === 'minor' ? 'outline' :
                                   strategy.qualityImpact === 'moderate' ? 'default' : 'destructive'}
                          className="text-xs"
                        >
                          {strategy.qualityImpact} impact
                        </Badge>
                      </div>
                      
                      <p className="text-sm text-muted-foreground">
                        {strategy.description}
                      </p>

                      {cost && !loadingCosts && (
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <span className="font-medium text-foreground">{cost.creditsRequired}</span>
                            credits
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="font-medium text-foreground">{formatTime(cost.estimatedTime)}</span>
                            estimated
                          </div>
                          {strategy.preservesCustomizations && (
                            <Badge variant="secondary" className="text-xs">
                              Preserves customizations
                            </Badge>
                          )}
                        </div>
                      )}

                      {loadingCosts && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Loading cost estimate...
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Detailed cost breakdown for selected strategy */}
                  {isSelected && cost && dialog.showCostBreakdown && (
                    <div className="mt-3 pt-3 border-t border-border/50">
                      <div className="text-xs font-medium text-muted-foreground mb-2">
                        Cost Breakdown:
                      </div>
                      <div className="space-y-1">
                        {cost.breakdown.map((item, index) => (
                          <div key={index} className="flex justify-between items-center text-xs">
                            <div>
                              <span className="text-foreground">{item.item}</span>
                              <span className="text-muted-foreground ml-1">- {item.description}</span>
                            </div>
                            <span className="font-medium">{item.credits} credits</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button 
              onClick={handleConfirm}
              disabled={!selectedStrategy}
            >
              {selectedStrategy ? 'Continue' : 'Select Strategy'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}