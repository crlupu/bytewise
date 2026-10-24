/**
 * Runs in <head> before anything paints, so a dark-mode visit never flashes white.
 * It also notes whether the last input was a pointer or a key: buttons the app
 * focuses show a focus ring only once a key has been pressed (see globals.css).
 */
export const THEME_SCRIPT = `(function(){try{var s=JSON.parse(localStorage.getItem("bytewise:settings")||"{}");var t=s.theme||"system";var d=t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);var r=document.documentElement;r.classList.add(d?"dark":"light");var m=s.motion||"system";r.dataset.motion=(m==="reduce"||(m==="system"&&matchMedia("(prefers-reduced-motion: reduce)").matches))?"reduce":"full";}catch(e){}var e=document.documentElement;addEventListener("pointerdown",function(){e.dataset.input="pointer"},true);addEventListener("keydown",function(){e.dataset.input="key"},true);})();`;
