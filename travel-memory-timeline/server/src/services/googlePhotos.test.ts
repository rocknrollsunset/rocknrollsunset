import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { photoFileName, pickedPhotos, pollIntervalMs, sniffImageExtension } from "./parsers/googlePhotos.js";
import { PHOTO_DIR, storedPhotoPath } from "./googlePhotos.js";

describe("Google Photos picker helpers", () => {
  it("keeps photos with a download URL, counts videos, and requests a 2048px rendition", () => {
    const { photos, videos } = pickedPhotos([
      {
        id: "p1",
        type: "PHOTO",
        createTime: "2026-03-14T18:07:39Z",
        mediaFile: { baseUrl: "https://lh3.example/abc", filename: "PXL_20260314_180739000.jpg" },
      },
      { id: "v1", type: "VIDEO", mediaFile: { baseUrl: "https://lh3.example/vid" } },
      { id: "p2", type: "PHOTO", mediaFile: {} },
      { id: "p3", type: "PHOTO", mediaFile: { baseUrl: "https://lh3.example/def" } },
    ]);
    assert.equal(videos, 1);
    assert.deepEqual(photos, [
      { id: "p1", filename: "PXL_20260314_180739000.jpg", day: "2026-03-14", downloadUrl: "https://lh3.example/abc=w2048-h2048" },
      { id: "p3", filename: "Photo", day: undefined, downloadUrl: "https://lh3.example/def=w2048-h2048" },
    ]);
  });

  it("recognizes browser-displayable images and rejects everything else", () => {
    assert.equal(sniffImageExtension(new Uint8Array([0xff, 0xd8, 0xff, 0xe0])), "jpg");
    assert.equal(sniffImageExtension(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a])), "png");
    assert.equal(sniffImageExtension(new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 ")), "webp");
    assert.equal(sniffImageExtension(new TextEncoder().encode("\0\0\0\x18ftypheic")), undefined);
    assert.equal(sniffImageExtension(new TextEncoder().encode("<html>")), undefined);
  });

  it("derives a stable, path-safe filename from the media item ID", () => {
    const name = photoFileName("AF1Qip/../weird id+=", "jpg");
    assert.match(name, /^[0-9a-f]{32}\.jpg$/);
    assert.equal(name, photoFileName("AF1Qip/../weird id+=", "jpg"));
  });

  it("reads polling intervals like '5s'", () => {
    assert.equal(pollIntervalMs("5s"), 5000);
    assert.equal(pollIntervalMs("0.2s"), 1000);
    assert.equal(pollIntervalMs(undefined), 5000);
  });

  it("only serves files inside the photo directory", () => {
    assert.equal(storedPhotoPath("abc.jpg"), `${PHOTO_DIR}/abc.jpg`);
    assert.equal(storedPhotoPath("../../etc/passwd"), undefined);
    assert.equal(storedPhotoPath("/etc/passwd"), undefined);
  });
});
