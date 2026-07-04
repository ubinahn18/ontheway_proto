import { File } from 'expo-file-system';
import { supabase } from './supabase';

// shared by item registration photos and delivery-completion proof photos —
// both just land in the same public item-photos bucket, namespaced by prefix
export async function uploadItemPhoto(userId: string, uri: string, prefix: string): Promise<string> {
  const fileExt = (uri.split('.').pop() ?? 'jpg').toLowerCase();
  const filePath = `${userId}/${prefix}-${Date.now()}.${fileExt}`;
  const contentType = fileExt === 'png' ? 'image/png' : fileExt === 'heic' ? 'image/heic' : 'image/jpeg';
  const arrayBuffer = await new File(uri).arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from('item-photos')
    .upload(filePath, arrayBuffer, { contentType });
  if (uploadError) throw uploadError;

  const {
    data: { publicUrl },
  } = supabase.storage.from('item-photos').getPublicUrl(filePath);

  return publicUrl;
}
