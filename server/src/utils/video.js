/**
 * Work out how to embed a video from the URL an admin pasted.
 *
 * The site never hosts footage: an admin pastes a YouTube or Facebook link and the
 * page embeds it. Parsing happens once, on the server, when the video is saved, so
 * the player can be rendered from stored fields without every visitor's browser
 * re-parsing URLs.
 *
 * @param {string} rawUrl
 * @returns {{ provider: 'YOUTUBE'|'FACEBOOK'|'OTHER', embedId: string, thumbnailUrl: string }}
 */
export function parseVideoUrl(rawUrl) {
  let url;
  try {
    url = new URL(String(rawUrl).trim());
  } catch {
    return { provider: "OTHER", embedId: "", thumbnailUrl: "" };
  }

  const host = url.hostname.replace(/^www\.|^m\./, "").toLowerCase();

  // A YouTube id is exactly 11 URL-safe characters. Checking the shape stops a
  // malformed link from being stored as an "id" and then placed in an iframe URL.
  const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

  if (host === "youtu.be") {
    const id = url.pathname.split("/").filter(Boolean)[0] ?? "";
    if (YOUTUBE_ID.test(id)) return youtube(id);
  }

  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    const fromQuery = url.searchParams.get("v") ?? "";
    if (YOUTUBE_ID.test(fromQuery)) return youtube(fromQuery);

    // /shorts/ID, /embed/ID, /live/ID
    const [kind, id = ""] = url.pathname.split("/").filter(Boolean);
    if (["shorts", "embed", "live", "v"].includes(kind) && YOUTUBE_ID.test(id)) {
      return youtube(id);
    }
  }

  if (host === "facebook.com" || host === "fb.watch" || host === "fb.com") {
    return { provider: "FACEBOOK", embedId: "", thumbnailUrl: "" };
  }

  return { provider: "OTHER", embedId: "", thumbnailUrl: "" };
}

function youtube(id) {
  return {
    provider: "YOUTUBE",
    embedId: id,
    thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
  };
}

export default { parseVideoUrl };
