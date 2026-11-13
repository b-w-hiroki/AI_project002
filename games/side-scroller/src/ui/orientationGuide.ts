import Phaser from "phaser";

/** Loadout only: DOM text stays legible outside the landscape FIT canvas. */
export function buildLoadoutOrientationGuide(scene: Phaser.Scene): void {
  const guide = document.createElement("section");
  guide.className = "orientation-guide";
  guide.setAttribute("aria-labelledby", "orientation-guide-title");
  const ja = document.documentElement.lang === "ja";
  guide.innerHTML = `
    <div class="orientation-guide__content">
      <p class="orientation-guide__eyebrow">BLADE WOODS</p>
      <img class="orientation-guide__hero" src="images/generated/characters/sf-hero-approved-idle-v3.png" alt="" />
      <svg class="orientation-guide__diagram" viewBox="0 0 180 80" aria-hidden="true">
        <rect x="14" y="12" width="34" height="56" rx="6" fill="none" stroke="currentColor" stroke-width="3" />
        <path d="M25 60h12 M67 42h27 M86 34l8 8-8 8" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
        <rect x="110" y="23" width="56" height="34" rx="6" fill="none" stroke="currentColor" stroke-width="3" />
        <path d="M158 34v12" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
      </svg>
      <h1 id="orientation-guide-title">${ja ? "横向きにして、森へ" : "Turn sideways to begin"}</h1>
      <p class="orientation-guide__instruction">${ja ? "スマホを横向きにすると<br>装備を選んで出発できます。" : "Rotate your phone to landscape.<br>Choose your gear and enter the forest."}</p>
      <p class="orientation-guide__hint">${ja ? "回転しないときは、画面の向きのロックを解除" : "Not rotating? Turn off orientation lock."}</p>
    </div>`;
  document.body.appendChild(guide);
  const hero = guide.querySelector("img")!;
  hero.addEventListener("error", () => { hero.hidden = true; }, { once: true });
  const check = () => {
    const portrait = window.innerHeight > window.innerWidth;
    guide.hidden = !portrait;
    // Block pointer and keyboard activation of the covered loadout without
    // changing its state. The page's game-list return link remains available.
    scene.input.enabled = !portrait;
    if (scene.input.keyboard) scene.input.keyboard.enabled = !portrait;
  };
  check();
  window.addEventListener("resize", check);
  window.addEventListener("orientationchange", check);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    window.removeEventListener("resize", check);
    window.removeEventListener("orientationchange", check);
    guide.remove();
  });
}
