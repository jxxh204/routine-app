import { supabase } from '@/lib/supabase';
import { getAccessToken } from '@/lib/client-auth';

const BUCKET = 'proof-images';

function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, base64] = dataUrl.split(',');
  const mime = meta?.match(/:(.*?);/)?.[1] ?? 'image/jpeg';
  const bytes = atob(base64 ?? '');
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    arr[i] = bytes.charCodeAt(i);
  }
  return new Blob([arr], { type: mime });
}

function buildPath(userId: string, dateKey: string, routineKey: string): string {
  return `${userId}/${dateKey}/${routineKey}.jpg`;
}

/**
 * Upload proof image to Supabase Storage and update challenge_logs.proof_image_path.
 * Returns the storage path on success, null on failure.
 */
export async function uploadProofImage(
  dateKey: string,
  routineKey: string,
  dataUrl: string,
): Promise<string | null> {
  const client = supabase;
  if (!client) return null;

  const { data: userData } = await client.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return null;

  const path = buildPath(userId, dateKey, routineKey);
  const blob = dataUrlToBlob(dataUrl);

  const { error: uploadError } = await client.storage
    .from(BUCKET)
    .upload(path, blob, { upsert: true, contentType: blob.type });

  if (uploadError) {
    console.error('[proof-image-upload] storage upload failed:', uploadError.message);
    return null;
  }

  // Update challenge_logs with the image path via internal API
  try {
    const token = await getAccessToken();
    if (token) {
      const response = await fetch('/api/challenge/proof-path', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ dateKey, routineKey, proofImagePath: path }),
      });

      if (!response.ok) {
        console.error('[proof-image-upload] challenge_logs update failed:', response.status);
      }
    }
  } catch (error) {
    console.error('[proof-image-upload] challenge_logs update failed:', error);
    // Image is uploaded, path just not saved in DB — still return path
  }

  return path;
}

/**
 * Get a signed URL (60 min) for a proof image from Supabase Storage.
 */
export async function getProofImageUrl(storagePath: string): Promise<string | null> {
  const client = supabase;
  if (!client) return null;

  const { data, error } = await client.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 3600);

  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
