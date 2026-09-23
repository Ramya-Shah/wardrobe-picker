import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";

export interface PickedFile {
  uri: string;
  /** The photo's file name — used to match Claude's "image" field. */
  name: string;
  mimeType?: string | null;
}

function nameFor(asset: ImagePicker.ImagePickerAsset, i: number): string {
  if (asset.fileName) return asset.fileName;
  const fromUri = asset.uri.split("/").pop();
  return fromUri && /\.\w+$/.test(fromUri) ? fromUri : `photo-${i + 1}.jpg`;
}

/** Photos from the gallery (original quality, no editing). */
export async function pickPhotos(multiple: boolean): Promise<PickedFile[]> {
  const r = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsMultipleSelection: multiple,
    selectionLimit: multiple ? 0 : 1,
    quality: 1,
    exif: false,
  });
  if (r.canceled) return [];
  return r.assets.map((a, i) => ({ uri: a.uri, name: nameFor(a, i), mimeType: a.mimeType }));
}

export async function takePhoto(): Promise<PickedFile | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) throw new Error("Camera permission is needed to take a photo.");
  const r = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.9 });
  if (r.canceled) return null;
  const a = r.assets[0];
  return { uri: a.uri, name: nameFor(a, 0), mimeType: a.mimeType };
}

/** Photos via the Files app — always keeps the exact original file names. */
export async function pickPhotoFiles(multiple: boolean): Promise<PickedFile[]> {
  const r = await DocumentPicker.getDocumentAsync({ type: ["image/*"], multiple, copyToCacheDirectory: true });
  if (r.canceled) return [];
  return r.assets.map((a) => ({ uri: a.uri, name: a.name, mimeType: a.mimeType }));
}

export async function pickTextFile(): Promise<PickedFile | null> {
  const r = await DocumentPicker.getDocumentAsync({ type: ["application/json", "text/plain", "*/*"], copyToCacheDirectory: true });
  if (r.canceled) return null;
  const a = r.assets[0];
  return { uri: a.uri, name: a.name, mimeType: a.mimeType };
}
