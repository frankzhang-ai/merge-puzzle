import { IS_NATIVE_BUILD } from '../config/runtime.ts';

/** Thin bridge to the Capacitor plugins injected by the iOS shell. No-ops on the web. */
type Plugin = Record<string, (...args: never[]) => unknown>;
type CapacitorGlobal = { isNativePlatform?: () => boolean; Plugins?: Record<string, Plugin | undefined> };

const cap = (): CapacitorGlobal | undefined => (window as Window & { Capacitor?: CapacitorGlobal }).Capacitor;

export function isNative(): boolean {
  if (!IS_NATIVE_BUILD) return false;
  try { return Boolean(cap()?.isNativePlatform?.()); } catch { return false; }
}

export type HapticKind = 'drop' | 'merge' | 'combo' | 'clear' | 'fail';

export function haptic(kind: HapticKind): void {
  if (!isNative()) return;
  try {
    const h = cap()?.Plugins?.Haptics as { impact?: (o: { style: string }) => unknown; notification?: (o: { type: string }) => unknown } | undefined;
    if (!h) return;
    if (kind === 'clear') void h.notification?.({ type: 'SUCCESS' });
    else if (kind === 'fail') void h.notification?.({ type: 'ERROR' });
    else void h.impact?.({ style: kind === 'drop' ? 'LIGHT' : kind === 'merge' ? 'MEDIUM' : 'HEAVY' });
  } catch { /* haptics are best effort */ }
}

/** Status bar style + pause/save when the app leaves the foreground. */
export function initNative(onBackground: () => void): void {
  if (!isNative()) return;
  try { void (cap()?.Plugins?.StatusBar as { setStyle?: (o: { style: string }) => unknown } | undefined)?.setStyle?.({ style: 'LIGHT' }); } catch { /* optional */ }
  try {
    const app = cap()?.Plugins?.App as { addListener?: (e: string, cb: (s: { isActive: boolean }) => void) => unknown } | undefined;
    void app?.addListener?.('appStateChange', (state) => { if (!state.isActive) onBackground(); });
  } catch { /* fall back to visibilitychange below */ }
  document.addEventListener('visibilitychange', () => { if (document.hidden) onBackground(); });
}

/** Safe-area insets in CSS px, measured with a probe (env() is only resolved in real layout). */
export function safeInsets(): { top: number; bottom: number } {
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;left:0;top:0;width:0;visibility:hidden;pointer-events:none;'
    + 'padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)';
  document.body.appendChild(probe);
  const style = getComputedStyle(probe);
  const insets = { top: parseFloat(style.paddingTop) || 0, bottom: parseFloat(style.paddingBottom) || 0 };
  probe.remove();
  return insets;
}
