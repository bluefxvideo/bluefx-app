/**
 * Test User Flow Examples for Script-to-Video
 * 
 * This file contains example scripts and test scenarios
 * to demonstrate the complete user flow from script generation
 * to timeline editing to video export.
 */

import type { VideoEditorState, VideoEditorActions } from '../store/video-editor-store';

export const TEST_SCRIPTS = {
  startup_validation: `Hook: Did you know 90% of startups fail because of one simple mistake?

They focus on the product instead of understanding their customers.

Here's how to validate your idea in just 48 hours.

Step 1: Create a simple landing page with your value proposition.

Step 2: Drive traffic using targeted social media posts.

Step 3: Collect emails and feedback from interested users.

If you get 100+ signups, you've validated market demand!

Follow for more startup tips that actually work. Like and subscribe!`,

  productivity_tips: `Stop wasting 3 hours a day on these productivity killers.

Number 1: Checking email every 5 minutes destroys your focus.

Number 2: Multitasking makes you 40% less productive.

Number 3: Not time-blocking leads to reactive work patterns.

Here's what successful people do instead.

They batch email checking to 3 times per day.

They use deep work blocks for important tasks.

They plan their day the night before.

Try this for one week and watch your productivity soar.`,

  cooking_hack: `This 30-second cooking trick will change your life.

You've been cooking pasta wrong this whole time.

Instead of boiling water first, try this method.

Put pasta and cold water in the pan together.

Turn on high heat and stir occasionally.

The pasta releases starch gradually, creating perfect texture.

Plus you save time and energy costs.

Your pasta will taste better and be less sticky.

Try this tonight and thank me later!`,

  fitness_motivation: `Your gym routine is sabotaging your results.

Here's what trainers don't want you to know.

You don't need 2 hours at the gym every day.

Just 20 minutes of focused training beats hours of wandering.

Focus on compound movements: squats, deadlifts, push-ups.

Quality over quantity, always.

Progressive overload is the secret to growth.

Consistency beats perfection every single time.

Start small, stay consistent, see amazing results.`
};

export const TEST_SETTINGS = {
  professional: {
    video_style: {
      tone: 'professional' as const,
      pacing: 'medium' as const,
      visual_style: 'realistic' as const,
    },
    voice_settings: {
      voice_id: 'anna' as const,
      speed: 'normal' as const,
      emotion: 'confident' as const,
    }
  },

  energetic: {
    video_style: {
      tone: 'energetic' as const,
      pacing: 'fast' as const,
      visual_style: 'dynamic' as const,
    },
    voice_settings: {
      voice_id: 'felix' as const,
      speed: 'faster' as const,
      emotion: 'excited' as const,
    }
  },

  educational: {
    video_style: {
      tone: 'educational' as const,
      pacing: 'slow' as const,
      visual_style: 'minimal' as const,
    },
    voice_settings: {
      voice_id: 'eric' as const,
      speed: 'slower' as const,
      emotion: 'calm' as const,
    }
  }
};

/**
 * Test User Flow Functions
 */
export class TestUserFlow {
  static async simulateScriptGeneration(store: VideoEditorState & VideoEditorActions, scriptKey: keyof typeof TEST_SCRIPTS) {
    const script = TEST_SCRIPTS[scriptKey];
    const settings = TEST_SETTINGS.professional;
    
    console.log('🎬 Starting video generation with script:', scriptKey);
    console.log('📝 Script length:', script.length, 'characters');
    
    // Update project settings
    store.updateProject({
      generation_settings: settings,
      aspect_ratio: '9:16'
    });
    
    // Generate from script
    await store.generateFromScript(script);
    
    console.log('✅ Video generation completed!');
    console.log('📊 Generated segments:', store.segments.length);
    console.log('⏱️ Total duration:', store.project.duration, 'seconds');
  }
  
  static simulateEditorInteractions(store: VideoEditorState & VideoEditorActions) {
    console.log('🎨 Simulating editor interactions...');
    
    // Change typography
    store.updateTypography({
      font_family: 'Inter',
      font_weight: 700,
      text_align: 'center'
    });
    
    // Change colors
    store.updateColors({
      text_color: '#ffffff',
      highlight_color: '#ff0000'
    });
    
    // Select first segment
    if (store.segments.length > 0) {
      store.selectSegment(store.segments[0].id);
    }
    
    // Change timeline zoom
    store.setZoom(1.5);
    
    // Simulate playback
    store.play();
    setTimeout(() => {
      store.pause();
      store.seek(10);
    }, 2000);
    
    console.log('🎨 Editor interactions completed');
  }
  
  static async simulateExportFlow(store: VideoEditorState & VideoEditorActions) {
    console.log('📤 Starting export process...');
    
    // Get Remotion config
    const remotionConfig = store.getRemotionConfig();
    console.log('⚙️ Remotion config generated:', remotionConfig);
    
    // Start export
    await store.exportVideo('mp4');
    
    console.log('🎉 Export completed!');
    console.log('📁 Export history:', store.export.history.length, 'items');
  }
  
  static async runCompleteFlow(store: VideoEditorState & VideoEditorActions, scriptKey: keyof typeof TEST_SCRIPTS = 'startup_validation') {
    console.log('🚀 Running complete user flow test...');
    
    try {
      // Step 1: Generate video from script
      await this.simulateScriptGeneration(store, scriptKey);
      
      // Step 2: Interact with editor
      this.simulateEditorInteractions(store);
      
      // Step 3: Export video
      await this.simulateExportFlow(store);
      
      console.log('✅ Complete user flow test successful!');
      return true;
    } catch (error) {
      console.error('❌ User flow test failed:', error);
      return false;
    }
  }
}

/**
 * Usage Example:
 * 
 * import { useVideoEditorStore } from '../store/video-editor-store';
 * import { TestUserFlow } from './test-user-flow';
 * 
 * // In a component or test:
 * const store = useVideoEditorStore();
 * TestUserFlow.runCompleteFlow(store, 'startup_validation');
 */