/**
 * DEMO IMAGERY — maps demo image keys to hand-picked placeholder photos from
 * picsum.photos (Unsplash-licensed). Chosen to suit the product (people, food,
 * gatherings, cities, outdoors), with no children. Real media will come from
 * Supabase Storage signed URLs instead.
 */

const PORTRAITS: Record<string, number> = {
  "hearth-me": 1005,
  "hearth-marcus": 856,
  "hearth-bennett": 1012,
  "hearth-jonah": 669,
  "hearth-teo": 513,
  "hearth-callum": 447,
  "hearth-rafa": 91,
  "hearth-wes": 685,
  "hearth-hugo": 883,
  "hearth-sam": 453,
  "hearth-eli": 22,
  "hearth-grant": 203,
  "hearth-kai": 602,
  "hearth-noah": 177,
};

const SCENES: Record<string, number> = {
  // Posts
  "hearth-post-rafa-a": 1067,
  "hearth-post-rafa-b": 985,
  "hearth-post-rafa-c": 454,
  "hearth-post-hugo-a": 635,
  "hearth-post-marcus-a": 292,
  "hearth-post-marcus-b": 117,
  "hearth-post-kai-a": 526,
  "hearth-post-bennett-a": 625,
  "hearth-post-bennett-b": 76,
  "hearth-post-sam-a": 158,
  "hearth-post-teo-a": 488,
  "hearth-post-me-a": 999,
  "hearth-post-me-b": 1043,
  "hearth-post-me-c": 1060,
  // Stories
  "hearth-story-rafa-1": 250,
  "hearth-story-rafa-2": 1067,
  "hearth-story-sam-1": 452,
  "hearth-story-hugo-1": 1036,
  "hearth-story-hugo-2": 1061,
  "hearth-story-hugo-3": 431,
  "hearth-story-kai-1": 40,
  "hearth-story-marcus-1": 117,
  "hearth-story-jonah-1": 400,
  "hearth-story-jonah-2": 530,
  "hearth-story-teo-1": 1060,
  // Chat, onboarding, marketing
  "hearth-chat-marcus-1": 292,
  "hearth-pick-1": 338,
  "hearth-pick-2": 768,
  "hearth-pick-3": 1009,
  "hearth-pick-4": 331,
  "hearth-pick-5": 473,
  "hearth-pick-6": 661,
  "hearth-land-1": 395,
  "hearth-land-2": 129,
  "hearth-land-3": 635,
  "hearth-land-4": 117,
  "hearth-land-5": 1067,
  "hearth-auth-cover": 195,
};

/** Lifestyle pool for gallery photos and any unmapped key. */
const POOL = [
  117, 129, 195, 192, 42, 163, 431, 635, 686, 437, 395, 425, 429, 488, 625, 655, 551, 1059, 39, 250, 76, 103, 768, 1060,
  30, 63, 225, 292, 102, 75, 312, 998, 999, 1080, 835, 882, 1043, 1039, 177, 1067, 985,
];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function demoImageUrl(key: string, width: number, height: number) {
  const id = PORTRAITS[key] ?? SCENES[key] ?? POOL[hash(key) % POOL.length];
  return `https://picsum.photos/id/${id}/${width}/${height}`;
}
