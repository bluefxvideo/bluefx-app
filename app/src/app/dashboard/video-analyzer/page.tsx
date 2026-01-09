import { Metadata } from 'next';
import { VideoAnalyzerPage } from '@/components/video-analyzer/video-analyzer-page';

export const metadata: Metadata = {
  title: 'Video Analyzer | BlueFX AI',
  description: 'Analyze and break down videos with AI-powered scene detection.',
};

export default function VideoAnalyzerRoute() {
  return <VideoAnalyzerPage />;
}
