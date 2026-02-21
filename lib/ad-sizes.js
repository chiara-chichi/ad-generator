export const adSizes = [
  {
    id: "instagram-square",
    name: "Instagram Square",
    width: 1080,
    height: 1080,
    aspectRatio: "1:1",
    channel: "instagram",
  },
  {
    id: "instagram-story",
    name: "Instagram Story",
    width: 1080,
    height: 1920,
    aspectRatio: "9:16",
    channel: "instagram",
  },
  {
    id: "facebook-feed",
    name: "Facebook Feed",
    width: 1200,
    height: 628,
    aspectRatio: "1.91:1",
    channel: "facebook",
  },
  {
    id: "facebook-story",
    name: "Facebook Story",
    width: 1080,
    height: 1920,
    aspectRatio: "9:16",
    channel: "facebook",
  },
  {
    id: "pinterest",
    name: "Pinterest Pin",
    width: 1000,
    height: 1500,
    aspectRatio: "2:3",
    channel: "pinterest",
  },
  {
    id: "custom",
    name: "Custom Size",
    width: 1080,
    height: 1080,
    aspectRatio: "custom",
    channel: "other",
  },
];

export function getAdSize(id) {
  return adSizes.find((s) => s.id === id) || adSizes[0];
}
