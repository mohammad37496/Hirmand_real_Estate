import assert from "node:assert/strict";
import { test } from "node:test";
import { extractDivarMediaUrls, getDivarAgencyReason } from "./divar.ts";
import { mediaSourceCandidates } from "./media.ts";

test("extractDivarMediaUrls finds nested CDN image URLs even when the leaf key is generic", () => {
  const urls = extractDivarMediaUrls({
    widgets: [
      {
        data: {
          media: [
            { value: "https://img.divarcdn.com/sample/one.jpg" },
            { value: "https://img.divarcdn.com/sample/two.webp" },
          ],
        },
      },
    ],
  });

  assert.deepEqual(urls, [
    "https://img.divarcdn.com/sample/one.jpg",
    "https://img.divarcdn.com/sample/two.webp",
  ]);
});

test("extractDivarMediaUrls does not mistake a normal Divar listing URL for an image", () => {
  const urls = extractDivarMediaUrls({
    source_url: "https://divar.ir/v/abcdef",
    media: {
      image: "https://divar.ir/images/sample.jpg",
    },
  });

  assert.deepEqual(urls, ["https://divar.ir/images/sample.jpg"]);
});

test("Divar agency filter catches explicit agency wording", () => {
  const reason = getDivarAgencyReason({
    web_info: {
      business_type: "real-estate-business",
      title: "فروش آپارتمان",
    },
  });

  assert.ok(reason);
});

test("public media candidates keep Divar images same-origin through the proxy", () => {
  const source = "https://img.divarcdn.com/sample/one.jpg";
  assert.deepEqual(mediaSourceCandidates(source), [
    "/api/media-proxy?url=" + encodeURIComponent(source),
  ]);
});
