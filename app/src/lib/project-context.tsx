'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import {
  AdProject,
  AnalysisData,
  AnalysisShot,
  ProjectExtractedFrame,
  ProjectGeneratedVideo,
  ProjectReferenceImage,
  getProject,
  updateProject as updateProjectDb,
  createProject as createProjectDb,
  ProjectSourceType,
} from '@/actions/database/projects-database';

// ============================================================================
// Context Types
// ============================================================================

interface ProjectContextType {
  // Current project state
  project: AdProject | null;
  projectId: string | null;
  isLoading: boolean;
  error: string | null;

  // Core actions
  loadProject: (projectId: string) => Promise<boolean>;
  createProject: (userId: string, data?: { name?: string; source_type?: ProjectSourceType; source_url?: string }) => Promise<string | null>;
  updateProject: (data: Partial<AdProject>) => Promise<boolean>;
  clearProject: () => void;

  // Convenience actions
  saveAnalysis: (data: AnalysisData) => Promise<boolean>;
  saveStoryboard: (gridImageUrl: string, style?: string) => Promise<boolean>;
  addFrame: (frame: ProjectExtractedFrame) => Promise<boolean>;
  addVideo: (video: ProjectGeneratedVideo) => Promise<boolean>;
  addReferenceImage: (image: ProjectReferenceImage) => Promise<boolean>;

  // Derived getters for common data
  analysisShots: AnalysisShot[] | null;
  extractedFrames: ProjectExtractedFrame[];
  generatedVideos: ProjectGeneratedVideo[];
  referenceImages: ProjectReferenceImage[];
}

// ============================================================================
// Context Creation
// ============================================================================

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

// ============================================================================
// Provider Component
// ============================================================================

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [project, setProject] = useState<AdProject | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track if we've already loaded this project to avoid duplicate fetches
  const loadedProjectRef = useRef<string | null>(null);

  /**
   * Load a project from the database
   */
  const loadProject = useCallback(async (id: string): Promise<boolean> => {
    // Avoid duplicate loads
    if (loadedProjectRef.current === id && project?.id === id) {
      return true;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await getProject(id);
      if (result.success && result.project) {
        setProject(result.project);
        setProjectId(id);
        loadedProjectRef.current = id;
        return true;
      } else {
        setError(result.error || 'Failed to load project');
        return false;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error loading project';
      setError(message);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [project?.id]);

  /**
   * Create a new project and set it as current
   */
  const createProject = useCallback(async (
    userId: string,
    data?: { name?: string; source_type?: ProjectSourceType; source_url?: string }
  ): Promise<string | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await createProjectDb(userId, data);
      if (result.success && result.project) {
        setProject(result.project);
        setProjectId(result.project.id);
        loadedProjectRef.current = result.project.id;
        return result.project.id;
      } else {
        setError(result.error || 'Failed to create project');
        return null;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error creating project';
      setError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Update the current project in database and local state
   */
  const updateProject = useCallback(async (data: Partial<AdProject>): Promise<boolean> => {
    if (!projectId) {
      setError('No project loaded');
      return false;
    }

    try {
      const result = await updateProjectDb(projectId, data);
      if (result.success && result.project) {
        setProject(result.project);
        return true;
      } else {
        setError(result.error || 'Failed to update project');
        return false;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error updating project';
      setError(message);
      return false;
    }
  }, [projectId]);

  /**
   * Clear the current project from state
   */
  const clearProject = useCallback(() => {
    setProject(null);
    setProjectId(null);
    setError(null);
    loadedProjectRef.current = null;
  }, []);

  // ============================================================================
  // Convenience Methods
  // ============================================================================

  /**
   * Save analysis data and update status to storyboarding
   */
  const saveAnalysis = useCallback(async (data: AnalysisData): Promise<boolean> => {
    return updateProject({
      analysis_data: data,
      status: 'storyboarding',
      storyboard_prompt: data.storyboardPrompt || null,
    });
  }, [updateProject]);

  /**
   * Save storyboard grid and update status to generating
   */
  const saveStoryboard = useCallback(async (gridImageUrl: string, style?: string): Promise<boolean> => {
    return updateProject({
      grid_image_url: gridImageUrl,
      storyboard_style: style || null,
      status: 'generating',
    });
  }, [updateProject]);

  /**
   * Add an extracted frame (replaces if same frameNumber exists)
   */
  const addFrame = useCallback(async (frame: ProjectExtractedFrame): Promise<boolean> => {
    if (!project) return false;

    const existingFrames = project.extracted_frames || [];
    const updatedFrames = [
      ...existingFrames.filter(f => f.frameNumber !== frame.frameNumber),
      frame,
    ].sort((a, b) => a.frameNumber - b.frameNumber);

    return updateProject({ extracted_frames: updatedFrames });
  }, [project, updateProject]);

  /**
   * Add a generated video
   */
  const addVideo = useCallback(async (video: ProjectGeneratedVideo): Promise<boolean> => {
    if (!project) return false;

    const existingVideos = project.generated_videos || [];
    return updateProject({ generated_videos: [...existingVideos, video] });
  }, [project, updateProject]);

  /**
   * Add a reference image
   */
  const addReferenceImage = useCallback(async (image: ProjectReferenceImage): Promise<boolean> => {
    if (!project) return false;

    const existingImages = project.reference_images || [];
    return updateProject({ reference_images: [...existingImages, image] });
  }, [project, updateProject]);

  // ============================================================================
  // Derived Values
  // ============================================================================

  const analysisShots = project?.analysis_data?.shots || null;
  const extractedFrames = project?.extracted_frames || [];
  const generatedVideos = project?.generated_videos || [];
  const referenceImages = project?.reference_images || [];

  // ============================================================================
  // Context Value
  // ============================================================================

  const contextValue: ProjectContextType = {
    // State
    project,
    projectId,
    isLoading,
    error,
    // Core actions
    loadProject,
    createProject,
    updateProject,
    clearProject,
    // Convenience actions
    saveAnalysis,
    saveStoryboard,
    addFrame,
    addVideo,
    addReferenceImage,
    // Derived getters
    analysisShots,
    extractedFrames,
    generatedVideos,
    referenceImages,
  };

  return (
    <ProjectContext.Provider value={contextValue}>
      {children}
    </ProjectContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useProject() {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
}

// ============================================================================
// Optional Hook (doesn't throw if not in provider)
// ============================================================================

export function useProjectOptional() {
  return useContext(ProjectContext);
}
