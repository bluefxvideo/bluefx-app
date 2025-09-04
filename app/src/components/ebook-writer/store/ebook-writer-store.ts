'use client';

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { UploadedDocument } from '@/actions/tools/ebook-document-handler';
import { saveEbookSession, loadEbookSession } from '@/actions/database/ebook-writer-database';
import { generateEbookCover } from '@/actions/tools/ebook-cover-generator';

/**
 * Ebook Writer Zustand Store
 * Manages complex multi-step ebook generation state following the legacy analysis patterns
 */

// Core Types
export interface EbookChapter {
  id: string;
  title: string;
  description?: string;
  subsections: EbookSubsection[];
  content?: string;
  word_count?: number;
  status: 'pending' | 'generating' | 'completed' | 'error';
  generated_at?: string;
}

export interface EbookSubsection {
  id: string;
  title: string;
  hint: string;
  content?: string;
  word_count?: number;
  status: 'pending' | 'generating' | 'completed' | 'error';
}

export interface EbookOutline {
  id: string;
  chapters: EbookChapter[];
  total_chapters: number;
  estimated_word_count: number;
  complexity_level: 'beginner' | 'intermediate' | 'advanced';
  writing_tone: 'professional' | 'conversational' | 'academic' | 'engaging';
  target_audience: string;
  include_images: boolean;
  include_ctas: boolean;
  generated_at: string;
}

export interface EbookCover {
  id: string;
  image_url: string;
  style: string;
  color_scheme: string;
  font_style: string;
  author_name: string;
  subtitle?: string;
  generated_at: string;
}

export interface EbookMetadata {
  id: string;
  title: string;
  topic: string;
  selected_title_option?: string;
  cover?: EbookCover;
  outline?: EbookOutline;
  word_count_preference: 'short' | 'medium' | 'long';
  complexity: 'beginner' | 'intermediate' | 'advanced';
  writing_tone: 'professional' | 'conversational' | 'academic' | 'engaging';
  include_images: boolean;
  include_ctas: boolean;
  target_audience: string;
  status: 'draft' | 'in_progress' | 'completed' | 'exported';
  created_at: string;
  updated_at: string;
}

export interface GenerationProgress {
  current_step: 'topic' | 'title' | 'outline' | 'content' | 'cover' | 'export' | 'history';
  current_chapter_index?: number;
  current_section_index?: number;
  total_progress: number; // 0-100
  step_progress: number; // 0-100
  is_generating: boolean;
  estimated_time_remaining?: number;
  credits_used: number;
  error_message?: string;
}

export interface TitleOptions {
  options: string[];
  selected_index?: number;
  custom_title?: string;
  generated_at: string;
}

// Store State Interface
interface EbookWriterState {
  // Current project state
  current_ebook: EbookMetadata | null;
  title_options: TitleOptions | null;
  generation_progress: GenerationProgress;
  
  // Document context
  uploaded_documents: UploadedDocument[];
  context_instructions: string;
  
  // UI State
  active_tab: 'topic' | 'title' | 'outline' | 'content' | 'cover' | 'export' | 'history';
  selected_chapter_id?: string;
  sidebar_collapsed: boolean;
  show_progress_panel: boolean;
  has_triggered_title_generation: boolean;
  
  // History and persistence
  saved_ebooks: EbookMetadata[];
  auto_save_enabled: boolean;
  last_save_timestamp?: string;
  current_session_id?: string;
  is_loading_session: boolean;
  
  // Credits and limits
  available_credits: number;
  credits_estimate: {
    title_generation: number;
    outline_creation: number;
    content_generation: number;
    cover_generation: number;
    total_estimated: number;
  };
  
  // Actions
  // Topic & Title Management
  setTopic: (topic: string) => void;
  generateTitles: (topic: string, documents?: UploadedDocument[]) => Promise<void>;
  selectTitle: (index: number) => void;
  setCustomTitle: (title: string) => void;
  
  // Document Management
  setUploadedDocuments: (documents: UploadedDocument[]) => void;
  setContextInstructions: (instructions: string) => void;
  clearDocuments: () => void;
  
  // Outline Management
  generateOutline: (preferences: any) => Promise<void>;
  updateChapter: (chapterId: string, updates: Partial<EbookChapter>) => void;
  addChapter: (afterChapterId?: string) => void;
  removeChapter: (chapterId: string) => void;
  reorderChapters: (fromIndex: number, toIndex: number) => void;
  addSubsection: (chapterId: string) => void;
  removeSubsection: (chapterId: string, subsectionId: string) => void;
  
  // Content Generation
  generateChapterContent: (chapterId: string) => Promise<void>;
  generateSectionContent: (chapterId: string, sectionId: string) => Promise<void>;
  generateAllContent: () => Promise<void>;
  updateChapterContent: (chapterId: string, content: string) => void;
  updateSectionContent: (chapterId: string, sectionId: string, content: string) => void;
  
  // Cover Generation
  generateCover: (preferences: Partial<EbookCover>) => Promise<void>;
  updateCoverPreferences: (preferences: Partial<EbookCover>) => void;
  
  // Export & Save
  exportEbook: (format: 'pdf' | 'epub' | 'docx') => Promise<void>;
  saveCurrentEbook: () => Promise<void>;
  loadEbook: (ebookId: string) => Promise<void>;
  deleteEbook: (ebookId: string) => Promise<void>;
  
  // UI State Management
  setActiveTab: (tab: EbookWriterState['active_tab']) => void;
  setSelectedChapter: (chapterId: string) => void;
  toggleSidebar: () => void;
  toggleProgressPanel: () => void;
  
  // Progress Management
  updateProgress: (updates: Partial<GenerationProgress>) => void;
  resetProgress: () => void;
  
  // Utility Actions
  calculateCreditsEstimate: () => void;
  autoSave: (userId: string) => Promise<void>;
  clearCurrentProject: (userId: string) => Promise<void>;
  loadSession: (userId: string) => Promise<void>;
  saveSession: (userId: string) => Promise<void>;
  
  // Error Handling
  setError: (error: string) => void;
  clearError: () => void;
}

// Initial State
const initialState = {
  current_ebook: null,
  title_options: null,
  generation_progress: {
    current_step: 'topic' as const,
    total_progress: 0,
    step_progress: 0,
    is_generating: false,
    credits_used: 0,
  },
  uploaded_documents: [],
  context_instructions: '',
  active_tab: 'topic' as const,
  sidebar_collapsed: false,
  show_progress_panel: true,
  has_triggered_title_generation: false,
  saved_ebooks: [],
  auto_save_enabled: true,
  current_session_id: undefined,
  is_loading_session: false,
  available_credits: 0,
  credits_estimate: {
    title_generation: 0,
    outline_creation: 5,
    content_generation: 0,
    cover_generation: 10,
    total_estimated: 15,
  },
};

// Store Implementation
export const useEbookWriterStore = create<EbookWriterState>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,
        
        // Topic & Title Management
        setTopic: (topic: string) => {
          set(state => ({
            current_ebook: {
              ...state.current_ebook,
              id: state.current_ebook?.id || `ebook_${Date.now()}`,
              topic,
              title: state.current_ebook?.title || '', // Preserve existing title
              status: 'draft',
              created_at: state.current_ebook?.created_at || new Date().toISOString(),
              updated_at: new Date().toISOString(),
              word_count_preference: state.current_ebook?.word_count_preference || 'medium',
              complexity: state.current_ebook?.complexity || 'intermediate',
              writing_tone: state.current_ebook?.writing_tone || 'professional',
              include_images: state.current_ebook?.include_images ?? true,
              include_ctas: state.current_ebook?.include_ctas ?? true,
              target_audience: state.current_ebook?.target_audience || 'General audience',
            } as EbookMetadata,
            // Reset title generation flag when topic changes
            has_triggered_title_generation: false,
            // Clear title options when topic changes to trigger fresh generation
            title_options: null,
            generation_progress: {
              ...state.generation_progress,
              current_step: 'title',
              total_progress: 10,
            }
          }));
        },
        
        generateTitles: async (topic: string, documents?: UploadedDocument[]) => {
          console.log('🚀 Starting title generation for topic:', topic, 'with documents:', documents?.length || 0);
          
          set(state => ({
            has_triggered_title_generation: true,
            generation_progress: {
              ...state.generation_progress,
              is_generating: true,
              current_step: 'title',
            }
          }));
          
          try {
            // Call the server action for title generation
            const { generateEbookTitles } = await import('@/actions/tools/ebook-title-generator');
            
            console.log('📞 Calling generateEbookTitles server action...');
            const response = await generateEbookTitles({
              topic,
              uploaded_documents: documents || get().uploaded_documents,
            });
            
            console.log('📝 Title generation response:', response);
            
            if (!response.success) {
              console.error('❌ Title generation failed:', response.error);
              throw new Error(response.error || 'Title generation failed');
            }
            
            console.log('✅ Generated titles:', response.generated_titles);
            set(state => ({
              title_options: {
                options: response.generated_titles || [],
                generated_at: new Date().toISOString(),
              },
              generation_progress: {
                ...state.generation_progress,
                is_generating: false,
                total_progress: 20,
                step_progress: 100,
              }
            }));
            
            console.log('🔄 Title options updated in store, auto-save should trigger shortly...');
            
          } catch (error) {
            set(state => ({
              generation_progress: {
                ...state.generation_progress,
                is_generating: false,
                error_message: error instanceof Error ? error.message : 'Title generation failed',
              }
            }));
          }
        },
        
        selectTitle: (index: number) => {
          const state = get();
          if (!state.title_options || !state.current_ebook) return;
          
          const selectedTitle = state.title_options.options[index];
          set({
            current_ebook: {
              ...state.current_ebook,
              title: selectedTitle,
              selected_title_option: selectedTitle,
              updated_at: new Date().toISOString(),
            },
            title_options: {
              ...state.title_options,
              selected_index: index,
            },
            generation_progress: {
              ...state.generation_progress,
              current_step: 'outline',
              total_progress: 30,
            }
          });
        },
        
        setCustomTitle: (title: string) => {
          const state = get();
          if (!state.current_ebook) return;
          
          set({
            current_ebook: {
              ...state.current_ebook,
              title,
              updated_at: new Date().toISOString(),
            },
            title_options: {
              ...state.title_options,
              custom_title: title,
              selected_index: undefined,
            } as TitleOptions,
            generation_progress: {
              ...state.generation_progress,
              current_step: 'outline',
              total_progress: 30,
            }
          });
        },
        
        // Outline Management
        generateOutline: async (preferences: any) => {
          const state = get();
          if (!state.current_ebook) return;
          
          set(state => ({
            generation_progress: {
              ...state.generation_progress,
              is_generating: true,
              current_step: 'outline',
            }
          }));
          
          try {
            const { ebookWriterOrchestrator } = await import('@/actions/tools/ebook-writer-orchestrator');
            
            console.log('📞 Calling ebookWriterOrchestrator for outline generation...');
            const response = await ebookWriterOrchestrator({
              topic: state.current_ebook?.topic || '',
              title: state.current_ebook?.title || '',
              uploaded_documents: state.uploaded_documents,
              workflow_intent: 'outline_only',
              content_preferences: {
                word_count_level: preferences.word_count_preference || 'medium',
                complexity: preferences.complexity_level || 'intermediate',
                writing_tone: preferences.writing_tone || 'professional',
                include_images: preferences.include_images ?? true,
                include_ctas: preferences.include_ctas ?? true,
                target_audience: preferences.target_audience || 'General audience',
              }
            });
            
            console.log('📝 Outline generation response:', response);
            
            if (!response.success) {
              console.error('❌ Outline generation failed:', response.error);
              throw new Error(response.error || 'Outline generation failed');
            }
            
            if (!response.outline) {
              throw new Error('No outline generated');
            }
            
            console.log('✅ Generated outline:', response.outline);
            set(state => ({
              current_ebook: {
                ...state.current_ebook!,
                outline: response.outline!,
                updated_at: new Date().toISOString(),
              },
              generation_progress: {
                ...state.generation_progress,
                is_generating: false,
                current_step: 'content',
                total_progress: 50,
                step_progress: 100,
              }
            }));
            
          } catch (error) {
            set(state => ({
              generation_progress: {
                ...state.generation_progress,
                is_generating: false,
                error_message: error instanceof Error ? error.message : 'Outline generation failed',
              }
            }));
          }
        },
        
        // Content Generation
        generateChapterContent: async (chapterId: string) => {
          const state = get();
          if (!state.current_ebook?.outline) return;
          
          const chapterIndex = state.current_ebook.outline.chapters.findIndex(c => c.id === chapterId);
          if (chapterIndex === -1) return;
          
          const chapter = state.current_ebook.outline.chapters[chapterIndex];
          
          set(state => ({
            current_ebook: {
              ...state.current_ebook!,
              outline: {
                ...state.current_ebook!.outline!,
                chapters: state.current_ebook!.outline!.chapters.map(ch =>
                  ch.id === chapterId
                    ? { ...ch, status: 'generating' as const }
                    : ch
                )
              }
            },
            generation_progress: {
              ...state.generation_progress,
              is_generating: true,
              current_chapter_index: chapterIndex,
            }
          }));
          
          try {
            // Import the server action
            const { generateEbookChapterContent } = await import('@/actions/tools/ebook-writer-orchestrator');
            
            // Call the server action with chapter details
            const result = await generateEbookChapterContent(
              chapter.title,
              chapter.description || '',
              chapter.subsections || [],
              state.current_ebook.title || '',
              state.current_ebook.topic || '',
              2000, // target word count
              'engaging', // writing tone
              state.uploaded_documents
            );
            
            if (result.success && result.content) {
              // Calculate actual word count
              const wordCount = result.content.split(/\s+/).length;
              
              set(state => ({
                current_ebook: {
                  ...state.current_ebook!,
                  outline: {
                    ...state.current_ebook!.outline!,
                    chapters: state.current_ebook!.outline!.chapters.map(ch =>
                      ch.id === chapterId
                        ? {
                            ...ch,
                            status: 'completed' as const,
                            content: result.content,
                            word_count: wordCount,
                          }
                        : ch
                    )
                  }
                },
                generation_progress: {
                  ...state.generation_progress,
                  is_generating: false,
                  credits_used: state.generation_progress.credits_used + 8,
                }
              }));
            } else {
              throw new Error(result.error || 'Failed to generate content');
            }
            
          } catch (error) {
            set(state => ({
              current_ebook: {
                ...state.current_ebook!,
                outline: {
                  ...state.current_ebook!.outline!,
                  chapters: state.current_ebook!.outline!.chapters.map(chapter =>
                    chapter.id === chapterId
                      ? { ...chapter, status: 'error' as const }
                      : chapter
                  )
                }
              },
              generation_progress: {
                ...state.generation_progress,
                is_generating: false,
                error_message: error instanceof Error ? error.message : 'Content generation failed',
              }
            }));
          }
        },
        
        // Cover Generation
        generateCover: async (preferences: Partial<EbookCover>) => {
          const state = get();
          if (!state.current_ebook) return;
          
          set(state => ({
            generation_progress: {
              ...state.generation_progress,
              is_generating: true,
              current_step: 'cover',
              error_message: undefined,
            }
          }));
          
          try {
            // Get user ID for credits check
            const { createClient } = await import('@/app/supabase/client');
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            
            if (!user) {
              throw new Error('User not authenticated');
            }
            
            // Call the real cover generation API
            const result = await generateEbookCover({
              title: state.current_ebook.title || state.current_ebook.topic,
              subtitle: preferences.subtitle,
              authorName: preferences.author_name,
              topic: state.current_ebook.topic,
              style: preferences.style || 'minimal',
              colorScheme: preferences.color_scheme || 'blue',
              fontStyle: preferences.font_style || 'sans-serif',
              userId: user.id
            });
            
            if (!result.success || !result.coverUrl) {
              throw new Error(result.error || 'Failed to generate cover');
            }
            
            const newCover: EbookCover = {
              id: `cover_${Date.now()}`,
              image_url: result.coverUrl,
              style: preferences.style || 'minimal',
              color_scheme: preferences.color_scheme || 'blue',
              font_style: preferences.font_style || 'sans-serif',
              author_name: preferences.author_name || '',
              subtitle: preferences.subtitle,
              generated_at: new Date().toISOString(),
            };
            
            set(state => ({
              current_ebook: {
                ...state.current_ebook!,
                cover: newCover,
                updated_at: new Date().toISOString(),
              },
              generation_progress: {
                ...state.generation_progress,
                is_generating: false,
                current_step: 'export',
                total_progress: 90,
                credits_used: state.generation_progress.credits_used + (result.creditsUsed || 10),
              }
            }));
            
          } catch (error) {
            console.error('Cover generation error:', error);
            set(state => ({
              generation_progress: {
                ...state.generation_progress,
                is_generating: false,
                error_message: error instanceof Error ? error.message : 'Cover generation failed',
              }
            }));
          }
        },
        
        // UI State Management
        setActiveTab: (tab) => {
          set({ active_tab: tab });
        },
        
        setSelectedChapter: (chapterId) => {
          set({ selected_chapter_id: chapterId });
        },
        
        toggleSidebar: () => {
          set(state => ({ sidebar_collapsed: !state.sidebar_collapsed }));
        },
        
        toggleProgressPanel: () => {
          set(state => ({ show_progress_panel: !state.show_progress_panel }));
        },
        
        // Progress Management
        updateProgress: (updates) => {
          set(state => ({
            generation_progress: {
              ...state.generation_progress,
              ...updates,
            }
          }));
        },
        
        resetProgress: () => {
          set({
            generation_progress: {
              current_step: 'topic',
              total_progress: 0,
              step_progress: 0,
              is_generating: false,
              credits_used: 0,
            }
          });
        },
        
        // Utility Actions
        calculateCreditsEstimate: () => {
          const state = get();
          if (!state.current_ebook) return;
          
          const outline = state.current_ebook.outline;
          const contentCredits = outline ? outline.chapters.length * 8 : 40; // 8 credits per chapter
          
          set({
            credits_estimate: {
              title_generation: 0, // Free
              outline_creation: 5,
              content_generation: contentCredits,
              cover_generation: 10,
              total_estimated: 15 + contentCredits,
            }
          });
        },
        
        autoSave: async (userId: string) => {
          const state = get();
          if (!state.auto_save_enabled || !state.current_ebook || !userId) return;
          
          await state.saveSession(userId);
        },
        
        clearCurrentProject: async (userId: string) => {
          try {
            // First clear the database session
            const { clearEbookSession } = await import('@/actions/database/ebook-writer-database');
            const result = await clearEbookSession(userId);
            
            if (!result.success) {
              console.warn('Failed to clear database session:', result.error);
            } else {
              console.log('✅ Database session cleared successfully');
            }
          } catch (error) {
            console.error('Error clearing database session:', error);
          }
          
          // Then clear the local state
          set({
            current_ebook: null,
            title_options: null,
            generation_progress: {
              current_step: 'topic',
              total_progress: 0,
              step_progress: 0,
              is_generating: false,
              credits_used: 0,
            },
            active_tab: 'topic',
            current_session_id: undefined,
          });
        },

        // Session Management
        loadSession: async (userId: string) => {
          set({ is_loading_session: true });
          
          try {
            if (!userId) {
              console.warn('No userId provided for session loading');
              set({ is_loading_session: false });
              return;
            }

            const result = await loadEbookSession(userId);
            
            if (result.success && result.session) {
              const session = result.session;
              
              set({
                current_ebook: {
                  id: session.ebook_id,
                  topic: session.topic || '',
                  title: session.title || '',
                  status: 'draft',
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                  outline: session.outline as EbookOutline,
                  content: session.content,
                  cover: session.cover_metadata ? 
                    session.cover_metadata as EbookCover : 
                    (session.cover_url ? {
                      id: `cover_${session.ebook_id}`,
                      image_url: session.cover_url,
                      generated_at: new Date().toISOString(),
                    } : null)
                },
                title_options: session.title_options as TitleOptions,
                uploaded_documents: (session.uploaded_documents as UploadedDocument[]) || [],
                active_tab: (session.current_step as any) || 'topic',
                generation_progress: {
                  current_step: (session.current_step as any) || 'topic',
                  total_progress: session.generation_progress || 0,
                  step_progress: 0,
                  is_generating: false,
                  credits_used: 0,
                },
                current_session_id: session.ebook_id,
                is_loading_session: false,
              });
            } else {
              set({ is_loading_session: false });
            }
          } catch (error) {
            console.error('Failed to load session:', error);
            set({ is_loading_session: false });
          }
        },

        saveSession: async (userId: string) => {
          const state = get();
          
          try {
            if (!userId) {
              console.warn('No userId provided for session saving');
              return;
            }

            const sessionData = {
              topic: state.current_ebook?.topic,
              title: state.current_ebook?.title,
              title_options: state.title_options,
              outline: state.current_ebook?.outline,
              content: state.current_ebook?.content,
              cover_url: state.current_ebook?.cover?.image_url,
              cover_metadata: state.current_ebook?.cover, // Save full cover object
              uploaded_documents: state.uploaded_documents,
              current_step: state.active_tab,
              generation_progress: state.generation_progress.total_progress,
            };
            
            console.log('💾 Saving session data:', {
              ...sessionData,
              title_options_count: sessionData.title_options?.options?.length || 0,
              has_title_options: !!sessionData.title_options
            });

            const result = await saveEbookSession(userId, sessionData, state.current_session_id);
            
            if (result.success && result.ebook_id) {
              set({
                current_session_id: result.ebook_id,
                last_save_timestamp: new Date().toISOString(),
              });
            }
          } catch (error) {
            console.error('Failed to save session:', error);
          }
        },
        
        // Error Handling
        setError: (error: string) => {
          set(state => ({
            generation_progress: {
              ...state.generation_progress,
              error_message: error,
            }
          }));
        },
        
        clearError: () => {
          set(state => ({
            generation_progress: {
              ...state.generation_progress,
              error_message: undefined,
            }
          }));
        },
        
        // Document Management
        setUploadedDocuments: (documents: UploadedDocument[]) => {
          set({ uploaded_documents: documents });
        },
        
        setContextInstructions: (instructions: string) => {
          set({ context_instructions: instructions });
        },
        
        clearDocuments: () => {
          set({ uploaded_documents: [], context_instructions: '' });
        },
        
        // Outline manipulation actions
        updateChapter: (chapterId: string, updates: Partial<EbookChapter>) => {
          set(state => {
            if (!state.current_ebook?.outline) return state;
            
            return {
              current_ebook: {
                ...state.current_ebook,
                outline: {
                  ...state.current_ebook.outline,
                  chapters: state.current_ebook.outline.chapters.map(chapter =>
                    chapter.id === chapterId ? { ...chapter, ...updates } : chapter
                  )
                }
              }
            };
          });
        },
        
        addChapter: (afterChapterId?: string) => {
          set(state => {
            if (!state.current_ebook?.outline) return state;
            
            const newChapter: EbookChapter = {
              id: `chapter_${Date.now()}`,
              title: 'New Chapter',
              description: 'Chapter description',
              subsections: [],
              status: 'pending'
            };
            
            let chapters = [...state.current_ebook.outline.chapters];
            if (afterChapterId) {
              const index = chapters.findIndex(c => c.id === afterChapterId);
              if (index !== -1) {
                chapters.splice(index + 1, 0, newChapter);
              } else {
                chapters.push(newChapter);
              }
            } else {
              chapters.push(newChapter);
            }
            
            return {
              current_ebook: {
                ...state.current_ebook,
                outline: {
                  ...state.current_ebook.outline,
                  chapters,
                  total_chapters: chapters.length
                }
              }
            };
          });
        },
        
        removeChapter: (chapterId: string) => {
          set(state => {
            if (!state.current_ebook?.outline) return state;
            
            return {
              current_ebook: {
                ...state.current_ebook,
                outline: {
                  ...state.current_ebook.outline,
                  chapters: state.current_ebook.outline.chapters.filter(c => c.id !== chapterId),
                  total_chapters: state.current_ebook.outline.chapters.length - 1
                }
              }
            };
          });
        },
        
        reorderChapters: (fromIndex: number, toIndex: number) => {
          set(state => {
            if (!state.current_ebook?.outline) return state;
            
            const chapters = [...state.current_ebook.outline.chapters];
            const [movedChapter] = chapters.splice(fromIndex, 1);
            chapters.splice(toIndex, 0, movedChapter);
            
            return {
              current_ebook: {
                ...state.current_ebook,
                outline: {
                  ...state.current_ebook.outline,
                  chapters
                }
              }
            };
          });
        },
        
        addSubsection: (chapterId: string) => {
          set(state => {
            if (!state.current_ebook?.outline) return state;
            
            return {
              current_ebook: {
                ...state.current_ebook,
                outline: {
                  ...state.current_ebook.outline,
                  chapters: state.current_ebook.outline.chapters.map(chapter =>
                    chapter.id === chapterId
                      ? {
                          ...chapter,
                          subsections: [
                            ...chapter.subsections,
                            {
                              id: `subsection_${Date.now()}`,
                              title: 'New Subsection',
                              hint: 'Subsection content hint',
                              status: 'pending'
                            }
                          ]
                        }
                      : chapter
                  )
                }
              }
            };
          });
        },
        
        removeSubsection: (chapterId: string, subsectionId: string) => {
          set(state => {
            if (!state.current_ebook?.outline) return state;
            
            return {
              current_ebook: {
                ...state.current_ebook,
                outline: {
                  ...state.current_ebook.outline,
                  chapters: state.current_ebook.outline.chapters.map(chapter =>
                    chapter.id === chapterId
                      ? {
                          ...chapter,
                          subsections: chapter.subsections.filter(s => s.id !== subsectionId)
                        }
                      : chapter
                  )
                }
              }
            };
          });
        },
        
        generateSectionContent: async (_chapterId: string, _sectionId: string) => {
          // Implementation would generate content for specific section
        },
        
        generateAllContent: async () => {
          // Implementation would generate content for all chapters
        },
        
        updateChapterContent: (chapterId: string, content: string) => {
          set(state => {
            if (!state.current_ebook?.outline) return state;
            
            return {
              current_ebook: {
                ...state.current_ebook,
                outline: {
                  ...state.current_ebook.outline,
                  chapters: state.current_ebook.outline.chapters.map(chapter =>
                    chapter.id === chapterId 
                      ? { ...chapter, content, status: content ? 'completed' as const : 'pending' as const }
                      : chapter
                  )
                }
              }
            };
          });
        },
        
        updateSectionContent: (_chapterId: string, _sectionId: string, _content: string) => {
          // Implementation would update section content
        },
        
        updateCoverPreferences: (_preferences: Partial<EbookCover>) => {
          // Implementation would update cover preferences
        },
        
        exportEbook: async (_format: 'pdf' | 'epub' | 'docx') => {
          // Implementation would export ebook in specified format
        },
        
        saveCurrentEbook: async () => {
          // Implementation would save current ebook to database
        },
        
        loadEbook: async (_ebookId: string) => {
          // Implementation would load ebook from database
        },
        
        deleteEbook: async (_ebookId: string) => {
          // Implementation would delete ebook from database
        },
      }),
      {
        name: 'ebook-writer-store',
        partialize: (state) => ({
          saved_ebooks: state.saved_ebooks,
          auto_save_enabled: state.auto_save_enabled,
          sidebar_collapsed: state.sidebar_collapsed,
          show_progress_panel: state.show_progress_panel,
        }),
      }
    ),
    {
      name: 'ebook-writer',
    }
  )
);

// Computed state selectors
export const useEbookProgress = () => {
  return useEbookWriterStore(state => ({
    progress: state.generation_progress,
    isGenerating: state.generation_progress.is_generating,
    currentStep: state.generation_progress.current_step,
    creditsUsed: state.generation_progress.credits_used,
    error: state.generation_progress.error_message,
  }));
};

export const useEbookMetadata = () => {
  return useEbookWriterStore(state => ({
    ebook: state.current_ebook,
    titleOptions: state.title_options,
    hasProject: !!state.current_ebook,
  }));
};

export const useEbookUI = () => {
  return useEbookWriterStore(state => ({
    activeTab: state.active_tab,
    sidebarCollapsed: state.sidebar_collapsed,
    showProgressPanel: state.show_progress_panel,
    setActiveTab: state.setActiveTab,
    setSelectedChapter: state.setSelectedChapter,
    selected_chapter_id: state.selected_chapter_id,
    toggleSidebar: state.toggleSidebar,
    toggleProgressPanel: state.toggleProgressPanel,
  }));
};