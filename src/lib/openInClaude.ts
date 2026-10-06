// Without the API key the owner does the Claude step in the Claude app: we open a new chat with the
// request already filled in (and copy it too, in case the prefill is lost), then he pastes the answer back.
const NEW_CHAT = "https://claude.ai/new";
const MAX_URL_TEXT = 6000; // long requests go through the clipboard only

export function claudeUrl(text: string): string {
  return text.length <= MAX_URL_TEXT ? `${NEW_CHAT}?q=${encodeURIComponent(text)}` : NEW_CHAT;
}

/** Call straight from a click handler: Safari only allows the popup and clipboard inside the gesture. */
export function openInClaude(text: string): Promise<boolean> {
  const copied = navigator.clipboard?.writeText(text).then(() => true, () => false) ?? Promise.resolve(false);
  window.open(claudeUrl(text), "_blank", "noopener");
  return copied;
}
