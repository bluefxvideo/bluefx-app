/**
 * Avatar Images Copy Script
 * Downloads avatar images from legacy storage and uploads to new storage
 */

import { uploadImageToStorage } from '../actions/supabase-storage';

interface AvatarImageMigration {
  templateName: string;
  legacyUrl: string;
  newPath: string;
  filename: string;
}

// Avatar images to migrate from legacy to new storage
const AVATAR_MIGRATIONS: AvatarImageMigration[] = [
  {
    templateName: 'Business Professional',
    legacyUrl: 'https://ysaduphyqsmqicatfqpf.supabase.co/storage/v1/object/public/images/avatars/Corporate%20Jake-1748017819935.jpg',
    newPath: 'avatar-templates/business',
    filename: 'corporate-jake-male.jpg'
  },
  {
    templateName: 'Casual Narrator', 
    legacyUrl: 'https://ysaduphyqsmqicatfqpf.supabase.co/storage/v1/object/public/images/avatars/Laura-1748017921242.jpg',
    newPath: 'avatar-templates/casual',
    filename: 'laura-female.jpg'
  },
  {
    templateName: 'Creative Host',
    legacyUrl: 'https://ysaduphyqsmqicatfqpf.supabase.co/storage/v1/object/public/images/avatars/Maria-1748017934242.jpg',
    newPath: 'avatar-templates/creative', 
    filename: 'maria-female.jpg'
  },
  {
    templateName: 'Educational Instructor',
    legacyUrl: 'https://ysaduphyqsmqicatfqpf.supabase.co/storage/v1/object/public/images/avatars/Dr%20Bob-1748017962778.jpg',
    newPath: 'avatar-templates/educational',
    filename: 'dr-bob-male.jpg'
  },
  // Additional professional avatars
  {
    templateName: 'Corporate Executive Female',
    legacyUrl: 'https://ysaduphyqsmqicatfqpf.supabase.co/storage/v1/object/public/images/avatars/Corporate%20Kelly-1748017787193.jpg',
    newPath: 'avatar-templates/business',
    filename: 'corporate-kelly-female.jpg'
  },
  {
    templateName: 'Casual Creator Male',
    legacyUrl: 'https://ysaduphyqsmqicatfqpf.supabase.co/storage/v1/object/public/images/avatars/In%20Car%20Jordan-1748017886879.jpg', 
    newPath: 'avatar-templates/casual',
    filename: 'jordan-car-male.jpg'
  }
];

/**
 * Copy avatar images from legacy to new storage
 */
export async function copyAvatarImages() {
  console.log('🚀 Starting avatar image migration...');
  const results: { templateName: string; success: boolean; newUrl?: string; error?: string }[] = [];
  
  for (const migration of AVATAR_MIGRATIONS) {
    try {
      console.log(`📸 Copying ${migration.templateName}...`);
      
      // Step 1: Download image from legacy URL
      const response = await fetch(migration.legacyUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch ${migration.legacyUrl}: ${response.statusText}`);
      }
      
      const imageBlob = await response.blob();
      const imageFile = new File([imageBlob], migration.filename, { type: imageBlob.type });
      
      // Step 2: Upload to new storage
      const uploadResult = await uploadImageToStorage(imageFile, {
        bucket: 'images',
        folder: migration.newPath,
        filename: migration.filename,
        contentType: imageBlob.type,
      });
      
      if (!uploadResult.success) {
        throw new Error(`Upload failed: ${uploadResult.error}`);
      }
      
      console.log(`✅ Copied to: ${uploadResult.url}`);
      
      results.push({
        templateName: migration.templateName,
        success: true,
        newUrl: uploadResult.url
      });
      
    } catch (error) {
      console.error(`❌ Failed to copy ${migration.templateName}:`, error);
      results.push({
        templateName: migration.templateName,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
  
  // Summary
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`\n🎉 Migration completed:`);
  console.log(`✅ Successful: ${successful.length}`);
  console.log(`❌ Failed: ${failed.length}`);
  
  if (successful.length > 0) {
    console.log(`\n📋 Update database with new URLs:`);
    successful.forEach(result => {
      console.log(`UPDATE avatar_templates SET thumbnail_url = '${result.newUrl}' WHERE name = '${result.templateName}';`);
    });
  }
  
  return results;
}

// Helper function to get the new storage URL pattern
export function getNewStorageUrl(bucket: string, path: string): string {
  return `https://[NEW_PROJECT_ID].supabase.co/storage/v1/object/public/${bucket}/${path}`;
}

// Run if called directly
if (require.main === module) {
  copyAvatarImages().catch(console.error);
}