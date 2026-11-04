// Web-specific implementation of animated splash overlay
// Web applications load directly without native splash screen overlays,
// preventing SSR Reanimated worklet crashes (unknown module 59) and initial black screens.

import React from 'react';

export function AnimatedSplashOverlay() {
  return null;
}
