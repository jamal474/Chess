// Tiny sound helpers. Preload once, replay on demand.
const cache: Record<string, HTMLAudioElement> = {};
function get(name: string) {
  if (!cache[name]) cache[name] = new Audio(`/audio/${name}.mp3`);
  return cache[name];
}
export const playMove    = () => { try { const a = get("move-self"); a.currentTime = 0; void a.play(); } catch {} };
export const playCapture = () => { try { const a = get("capture");   a.currentTime = 0; void a.play(); } catch {} };
export const playNotify  = () => { try { const a = get("notify");    a.currentTime = 0; void a.play(); } catch {} };
