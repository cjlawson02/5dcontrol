import { Directory, File, Paths } from "expo-file-system";
import { Image } from "expo-image";
import { logger } from "./logger";

export type GalleryImage = {
  id: string;
  filename: string;
  uri: string;
  cacheKey: string;
  createdAt: number;
};

const GALLERY_DIR = "gallery-captures";

export function photoUrlForIp(ip: string): string {
  return `http://${ip}:8080/photo.jpg`;
}

/** Build an absolute media URL from a server HTTP path (e.g. /captures/id/full.jpg). */
export function mediaUrlForIp(ip: string, path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `http://${ip}:8080${normalized}`;
}

export function cacheKeyForFilename(filename: string): string {
  return `gallery:${filename}`;
}

export function getGalleryDirectory(): Directory {
  return new Directory(Paths.document, GALLERY_DIR);
}

export function ensureGalleryDirectory(): Directory {
  const dir = getGalleryDirectory();
  if (!dir.exists) {
    dir.create({ intermediates: true, idempotent: true });
  }
  return dir;
}

function isJpegFile(entry: Directory | File): entry is File {
  return entry instanceof File && entry.name.toLowerCase().endsWith(".jpg");
}

function toGalleryImage(file: File): GalleryImage {
  const filename = file.name;
  const id = filename.replace(/\.jpg$/i, "");
  const match = /^capture-(\d+)$/.exec(id);
  const createdAt = match ? Number(match[1]) : 0;
  return {
    id,
    filename,
    uri: file.uri,
    cacheKey: cacheKeyForFilename(filename),
    createdAt,
  };
}

/** List locally cached capture JPEGs (newest first). */
export function listGalleryImages(): GalleryImage[] {
  const dir = ensureGalleryDirectory();
  return dir
    .list()
    .filter(isJpegFile)
    .map(toGalleryImage)
    .sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Download the live-view snapshot (`/photo.jpg`) into the local gallery directory
 * and seed expo-image's disk cache for fast thumbnail/full display.
 */
export async function downloadLatestSnapshot(
  serverIp: string
): Promise<GalleryImage> {
  return downloadJpegUrl(serverIp, photoUrlForIp(serverIp));
}

/**
 * Download a capture still from an IMAGE_READY notify path into local gallery.
 * Uses imageId when present so re-downloads of the same capture are idempotent.
 */
export async function downloadCaptureStill(
  serverIp: string,
  fullPath: string,
  imageId?: string
): Promise<GalleryImage> {
  const url = mediaUrlForIp(serverIp, fullPath);
  const createdAt =
    imageId && /^\d+$/.test(imageId) ? Number(imageId) : Date.now();
  const filename = `capture-${createdAt}.jpg`;
  return downloadJpegUrl(serverIp, url, filename);
}

async function downloadJpegUrl(
  serverIp: string,
  url: string,
  filename?: string
): Promise<GalleryImage> {
  const dir = ensureGalleryDirectory();
  const resolvedName = filename ?? `capture-${Date.now()}.jpg`;
  const destination = new File(dir, resolvedName);

  logger.info(`Gallery: downloading from ${url} (ip=${serverIp})`);
  const downloaded = await File.downloadFileAsync(url, destination, {
    idempotent: true,
  });

  const image = toGalleryImage(downloaded);
  await seedExpoImageCache(image);
  return image;
}

/** Seed or refresh expo-image disk cache from a local file URI. */
export async function seedExpoImageCache(image: GalleryImage): Promise<void> {
  const existing = await Image.readFromCacheAsync(image.cacheKey);
  if (existing) {
    return;
  }
  await Image.writeToCacheAsync(image.uri, image.cacheKey);
}

/** Ensure every listed gallery image is present in expo-image's cache. */
export async function seedAllGalleryCaches(
  images: GalleryImage[]
): Promise<void> {
  await Promise.all(images.map((image) => seedExpoImageCache(image)));
}
