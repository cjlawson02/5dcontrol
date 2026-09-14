import {
  cacheKeyForFilename,
  downloadLatestSnapshot,
  ensureGalleryDirectory,
  listGalleryImages,
  photoUrlForIp,
  seedExpoImageCache,
} from "../../utils/galleryCache";
import { File } from "expo-file-system";
import { Image } from "expo-image";

describe("galleryCache", () => {
  beforeEach(() => {
    (global as any).__resetExpoFsStore?.();
    (global as any).__resetExpoImageCache?.();
  });

  it("builds the photo.jpg URL for a server IP", () => {
    expect(photoUrlForIp("192.168.1.1")).toBe("http://192.168.1.1:8080/photo.jpg");
  });

  it("builds stable cache keys", () => {
    expect(cacheKeyForFilename("capture-123.jpg")).toBe("gallery:capture-123.jpg");
  });

  it("creates the gallery directory and lists no images initially", () => {
    ensureGalleryDirectory();
    expect(listGalleryImages()).toEqual([]);
  });

  it("downloads a snapshot, lists it, and seeds expo-image cache", async () => {
    const image = await downloadLatestSnapshot("10.0.0.5");

    expect(image.filename).toMatch(/^capture-\d+\.jpg$/);
    expect(image.cacheKey).toBe(cacheKeyForFilename(image.filename));
    expect(image.uri).toContain(image.filename);

    const listed = listGalleryImages();
    expect(listed).toHaveLength(1);
    expect(listed[0].filename).toBe(image.filename);

    expect(Image.writeToCacheAsync).toHaveBeenCalledWith(
      image.uri,
      image.cacheKey
    );
  });

  it("skips writeToCacheAsync when the key is already seeded", async () => {
    const image = await downloadLatestSnapshot("10.0.0.5");
    (Image.writeToCacheAsync as jest.Mock).mockClear();

    await seedExpoImageCache(image);

    expect(Image.readFromCacheAsync).toHaveBeenCalledWith(image.cacheKey);
    expect(Image.writeToCacheAsync).not.toHaveBeenCalled();
  });

  it("uses File.downloadFileAsync against photo.jpg", async () => {
    const spy = jest.spyOn(File, "downloadFileAsync");
    await downloadLatestSnapshot("192.168.1.50");
    expect(spy).toHaveBeenCalledWith(
      "http://192.168.1.50:8080/photo.jpg",
      expect.objectContaining({ name: expect.stringMatching(/^capture-\d+\.jpg$/) }),
      { idempotent: true }
    );
    spy.mockRestore();
  });
});
