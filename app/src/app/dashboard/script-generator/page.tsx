import { Metadata } from 'next';
import { ScriptGeneratorPage } from '@/components/script-generator/script-generator-page';

export const metadata: Metadata = {
  title: 'Script Generator | BlueFX AI',
  description: 'Generate affiliate marketing scripts powered by AI.',
};

export default function ScriptGeneratorRoute() {
  return <ScriptGeneratorPage />;
}
