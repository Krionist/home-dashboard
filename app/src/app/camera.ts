// HA gives each camera a tokenised snapshot URL (entity_picture). `tick` only changes every refresh interval,
// so the browser serves the cached image in between instead of hitting the camera.
export function cameraSrc(base: string, picture: string | undefined, tick: number): string {
  if (!picture) return '';
  return `${base}${picture}${picture.includes('?') ? '&' : '?'}_=${tick}`;
}
