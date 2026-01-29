'use server';

import { createClient } from '@/app/supabase/server';
import { Json } from '@/types/database';

// ============================================================================
// Type Definitions
// ============================================================================

export interface AnalysisShot {
  shotNumber: number;
  startTime: string;
  endTime: string;
  duration: string;
  shotType: string;
  camera: string;
  description: string;
  action?: string;    // What movement/action happens in this shot
  dialogue?: string;  // What is being said (narration, voiceover, dialogue)
}

export interface AnalysisData {
  videoTitle?: string;
  totalDuration?: number;
  shots: AnalysisShot[];
  characterDescription?: string;
  visualStyle?: string;
  storyboardPrompt?: string;
}

export interface ProjectReferenceImage {
  id: string;
  url: string;
  type: 'character' | 'product' | 'environment' | 'other';
  label: string;
}

export interface ProjectExtractedFrame {
  frameNumber: number;
  row: number;
  col: number;
  originalUrl: string;
  upscaledUrl?: string;
  width: number;
  height: number;
  shotData?: {
    action?: string;
    dialogue?: string;
    duration_seconds?: number;
  };
}

export interface ProjectGeneratedVideo {
  id: string;
  frameNumber: number;
  videoUrl: string;
  prompt: string;
  duration: number;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  createdAt: string;
}

export type ProjectStatus = 'draft' | 'analyzing' | 'storyboarding' | 'generating' | 'completed';
export type ProjectSourceType = 'video_analysis' | 'script_idea' | 'manual';

export interface AdProject {
  id: string;
  user_id: string;
  name: string;
  status: ProjectStatus;
  source_type: ProjectSourceType | null;
  source_url: string | null;
  analysis_data: AnalysisData | null;
  storyboard_prompt: string | null;
  storyboard_style: string | null;
  grid_image_url: string | null;
  aspect_ratio: string;
  reference_images: ProjectReferenceImage[];
  extracted_frames: ProjectExtractedFrame[];
  generated_videos: ProjectGeneratedVideo[];
  camera_preset: string;
  created_at: string;
  updated_at: string;
}

// Response types
export interface ProjectResponse {
  success: boolean;
  project?: AdProject;
  error?: string;
}

export interface ProjectListResponse {
  success: boolean;
  projects: AdProject[];
  total?: number;
  error?: string;
}

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * Create a new project
 */
export async function createProject(
  userId: string,
  data: {
    name?: string;
    source_type?: ProjectSourceType;
    source_url?: string;
  } = {}
): Promise<ProjectResponse> {
  try {
    const supabase = await createClient();

    const { data: project, error } = await supabase
      .from('ad_projects')
      .insert({
        user_id: userId,
        name: data.name || 'Untitled Project',
        source_type: data.source_type || null,
        source_url: data.source_url || null,
        status: 'draft',
        reference_images: [],
        extracted_frames: [],
        generated_videos: [],
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create project:', error);
      return { success: false, error: error.message };
    }

    return { success: true, project: project as AdProject };
  } catch (error) {
    console.error('createProject error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create project',
    };
  }
}

/**
 * Get a project by ID
 */
export async function getProject(projectId: string): Promise<ProjectResponse> {
  try {
    const supabase = await createClient();

    const { data: project, error } = await supabase
      .from('ad_projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return { success: false, error: 'Project not found' };
      }
      console.error('Failed to get project:', error);
      return { success: false, error: error.message };
    }

    return { success: true, project: project as AdProject };
  } catch (error) {
    console.error('getProject error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get project',
    };
  }
}

/**
 * List projects for a user
 */
export async function listProjects(
  userId: string,
  limit: number = 50,
  offset: number = 0
): Promise<ProjectListResponse> {
  try {
    const supabase = await createClient();

    const { data: projects, error, count } = await supabase
      .from('ad_projects')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Failed to list projects:', error);
      return { success: false, projects: [], error: error.message };
    }

    return {
      success: true,
      projects: (projects || []) as AdProject[],
      total: count || 0,
    };
  } catch (error) {
    console.error('listProjects error:', error);
    return {
      success: false,
      projects: [],
      error: error instanceof Error ? error.message : 'Failed to list projects',
    };
  }
}

/**
 * Update a project
 */
export async function updateProject(
  projectId: string,
  data: Partial<Omit<AdProject, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
): Promise<ProjectResponse> {
  try {
    const supabase = await createClient();

    const { data: project, error } = await supabase
      .from('ad_projects')
      .update(data as Record<string, Json>)
      .eq('id', projectId)
      .select()
      .single();

    if (error) {
      console.error('Failed to update project:', error);
      return { success: false, error: error.message };
    }

    return { success: true, project: project as AdProject };
  } catch (error) {
    console.error('updateProject error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update project',
    };
  }
}

/**
 * Delete a project
 */
export async function deleteProject(projectId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    const { error } = await supabase
      .from('ad_projects')
      .delete()
      .eq('id', projectId);

    if (error) {
      console.error('Failed to delete project:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('deleteProject error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete project',
    };
  }
}

// ============================================================================
// Convenience Operations
// ============================================================================

/**
 * Save analysis data to a project
 */
export async function saveAnalysisToProject(
  projectId: string,
  analysisData: AnalysisData
): Promise<ProjectResponse> {
  return updateProject(projectId, {
    analysis_data: analysisData,
    status: 'storyboarding',
    storyboard_prompt: analysisData.storyboardPrompt || null,
  });
}

/**
 * Save storyboard grid to a project
 */
export async function saveStoryboardToProject(
  projectId: string,
  gridImageUrl: string,
  style?: string
): Promise<ProjectResponse> {
  return updateProject(projectId, {
    grid_image_url: gridImageUrl,
    storyboard_style: style || null,
    status: 'generating',
  });
}

/**
 * Add an extracted frame to a project
 */
export async function addExtractedFrame(
  projectId: string,
  frame: ProjectExtractedFrame
): Promise<ProjectResponse> {
  const { project } = await getProject(projectId);
  if (!project) {
    return { success: false, error: 'Project not found' };
  }

  const existingFrames = project.extracted_frames || [];
  // Replace existing frame with same number, or add new
  const updatedFrames = [
    ...existingFrames.filter(f => f.frameNumber !== frame.frameNumber),
    frame,
  ].sort((a, b) => a.frameNumber - b.frameNumber);

  return updateProject(projectId, { extracted_frames: updatedFrames });
}

/**
 * Add a generated video to a project
 */
export async function addGeneratedVideo(
  projectId: string,
  video: ProjectGeneratedVideo
): Promise<ProjectResponse> {
  const { project } = await getProject(projectId);
  if (!project) {
    return { success: false, error: 'Project not found' };
  }

  const existingVideos = project.generated_videos || [];
  const updatedVideos = [...existingVideos, video];

  return updateProject(projectId, { generated_videos: updatedVideos });
}

/**
 * Update a generated video's status
 */
export async function updateGeneratedVideoStatus(
  projectId: string,
  videoId: string,
  status: ProjectGeneratedVideo['status'],
  videoUrl?: string
): Promise<ProjectResponse> {
  const { project } = await getProject(projectId);
  if (!project) {
    return { success: false, error: 'Project not found' };
  }

  const updatedVideos = (project.generated_videos || []).map(v =>
    v.id === videoId
      ? { ...v, status, videoUrl: videoUrl || v.videoUrl }
      : v
  );

  return updateProject(projectId, { generated_videos: updatedVideos });
}

/**
 * Add a reference image to a project
 */
export async function addReferenceImage(
  projectId: string,
  image: ProjectReferenceImage
): Promise<ProjectResponse> {
  const { project } = await getProject(projectId);
  if (!project) {
    return { success: false, error: 'Project not found' };
  }

  const existingImages = project.reference_images || [];
  const updatedImages = [...existingImages, image];

  return updateProject(projectId, { reference_images: updatedImages });
}

/**
 * Remove a reference image from a project
 */
export async function removeReferenceImage(
  projectId: string,
  imageId: string
): Promise<ProjectResponse> {
  const { project } = await getProject(projectId);
  if (!project) {
    return { success: false, error: 'Project not found' };
  }

  const updatedImages = (project.reference_images || []).filter(i => i.id !== imageId);

  return updateProject(projectId, { reference_images: updatedImages });
}
