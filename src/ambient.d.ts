import '@girs/gjs';
import '@girs/gjs/dom';
import '@girs/gnome-shell/ambient';
import '@girs/gnome-shell/extensions/global';

declare module 'resource:///org/gnome/shell/misc/animationUtils.js' {
    export function adjustAnimationTime(msecs: number): number;
}
