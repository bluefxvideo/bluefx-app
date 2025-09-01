import { dispatch } from "@designcombo/events";
import { EDIT_OBJECT } from "@designcombo/state";
import { ITrackItem } from "@designcombo/types";

/**
 * Fix positioning for AI-generated images that were loaded with incorrect positioning
 * This addresses legacy images that were positioned at top: "0px", left: "0px"
 */
export function fixAIImagePositioning(trackItemsMap: Record<string, ITrackItem>) {
  console.log('🔧 Checking for AI images with incorrect positioning...');
  
  const aiImages = Object.values(trackItemsMap).filter(
    (item: ITrackItem) => 
      item.type === 'image' && 
      item.metadata?.aiGenerated === true
  );
  
  if (aiImages.length === 0) {
    console.log('ℹ️ No AI images found to fix');
    return;
  }
  
  console.log(`🔍 Found ${aiImages.length} AI images to check`);
  
  aiImages.forEach((item) => {
    const details = item.details;
    
    // Check if image has incorrect positioning (top-left corner positioning)
    // But SKIP images that have been manually positioned or have saved composition data
    const hasIncorrectPositioning = (
      details?.top === "0px" || 
      details?.top === 0 ||
      details?.left === "0px" || 
      details?.left === 0 ||
      (details?.transform && details.transform.includes('translate(0px, 0px)'))
    );
    
    // Don't fix images that already have proper positioning or come from saved compositions
    const hasExistingPositioning = (
      (details?.top && details.top !== "0px" && details.top !== 0) ||
      (details?.left && details.left !== "0px" && details.left !== 0) ||
      (details?.width && details.width > 0) ||
      (details?.height && details.height > 0) ||
      (details?.transform && !details.transform.includes('translate(0px, 0px)'))
    );
    
    if (hasExistingPositioning) {
      console.log(`ℹ️ AI image ${item.id} already has proper positioning, skipping fix`);
      return;
    }
    
    if (hasIncorrectPositioning) {
      console.log(`🔧 Fixing positioning for AI image: ${item.id}`);
      
      // Create new details object without positioning overrides
      // This lets the editor use default centering like sidebar images
      const fixedDetails = {
        src: details?.src,
        // Remove all explicit positioning to allow editor centering
        // Keep other properties that might be important
        ...(details?.opacity && { opacity: details.opacity }),
        ...(details?.borderRadius && { borderRadius: details.borderRadius }),
        ...(details?.visibility && { visibility: details.visibility }),
      };
      
      // Remove positioning-related properties
      const positioningProps = [
        'top', 'left', 'width', 'height', 'transform', 'transformOrigin',
        'crop', 'background', 'border', 'borderWidth', 'boxShadow',
        'blur', 'brightness', 'flipX', 'flipY', 'rotate'
      ];
      
      positioningProps.forEach(prop => {
        if (fixedDetails.hasOwnProperty(prop)) {
          delete fixedDetails[prop];
        }
      });
      
      // Dispatch update to fix the positioning
      dispatch(EDIT_OBJECT, {
        payload: {
          id: item.id,
          details: fixedDetails
        }
      });
      
      console.log(`✅ Fixed positioning for AI image: ${item.id}`);
    } else {
      console.log(`ℹ️ AI image ${item.id} positioning is already correct`);
    }
  });
}

/**
 * Fix positioning for AI-generated captions
 */
export function fixAICaptionPositioning(trackItemsMap: Record<string, ITrackItem>) {
  console.log('🔧 Checking for AI captions positioning...');
  
  const aiCaptions = Object.values(trackItemsMap).filter(
    (item: ITrackItem) => 
      item.type === 'text' && 
      item.details?.isCaptionTrack === true
  );
  
  if (aiCaptions.length === 0) {
    console.log('ℹ️ No AI captions found to fix');
    return;
  }
  
  console.log(`🔍 Found ${aiCaptions.length} caption tracks to check`);
  
  aiCaptions.forEach((item) => {
    const details = item.details;
    
    // Check if captions don't have proper bottom positioning
    const needsPositionFix = !details?.top || details.top === "0px" || details.top === 0;
    
    if (needsPositionFix) {
      console.log(`🔧 Fixing caption positioning for: ${item.id}`);
      
      // Update caption positioning
      dispatch(UPDATE_TRACK_ITEM, {
        payload: {
          id: item.id,
          details: {
            ...details,
            // Position captions towards bottom center
            top: '75%', // 75% from top = towards bottom
            left: '50%', // 50% from left = center horizontally
            transform: 'translate(-50%, -50%)', // Center the text element itself
            width: '80%', // Don't take full width
          }
        }
      });
      
      console.log(`✅ Fixed caption positioning for: ${item.id}`);
    } else {
      console.log(`ℹ️ Caption ${item.id} positioning is already correct`);
    }
  });
}

/**
 * Main function to fix all AI asset positioning issues
 */
export function fixAllAIAssetPositioning(trackItemsMap: Record<string, ITrackItem>) {
  console.log('🚀 Starting AI asset positioning fixes...');
  
  fixAIImagePositioning(trackItemsMap);
  fixAICaptionPositioning(trackItemsMap);
  
  console.log('✅ AI asset positioning fixes completed');
}