import Phaser from 'phaser';
import { FONT_SIZE, MENU, MENU_DEPTH, TOP_BAR, TOP_BAR_CY, WORLD_Y } from '../../constants';
import { getLang, setLang, type Lang } from '../../i18n';
import { gameAudio } from '../../audio';
import { addGlyph, addNeutralButton, drawStoneBar, toggleFullscreen } from '../common';

/**
 * Pasek górny menu: flagi języków po lewej, pełny ekran po prawej.
 * Ikona dźwięku stoi na dolnym pasku (patrz buildMenuBottomBar).
 */
export function buildMenuTopBar(scene: Phaser.Scene) {
  drawStoneBar(scene, TOP_BAR_CY, WORLD_Y, MENU_DEPTH.bars);
  buildLanguageSwitch(scene);

  /* Taki sam przycisk pełnego ekranu jak w scenie gry: rozmiar i glif z paska górnego gry. */
  addNeutralButton(scene, TOP_BAR.fullscreenX, TOP_BAR_CY, TOP_BAR.button.w, TOP_BAR.button.h, () => {
    gameAudio.uiClick();
    toggleFullscreen(scene);
  });
  addGlyph(scene, TOP_BAR.fullscreenX, TOP_BAR_CY, '⧉', FONT_SIZE.hudGlyph);
}

/**
 * Dwie okrągłe flagi (PL, EN): aktywny język — flaga kolorowa, nieaktywny — czarno-biała.
 * Kliknięcie zapamiętuje wybór i przeładowuje menu.
 */
function buildLanguageSwitch(scene: Phaser.Scene) {
  const { size, gap, left, inactiveAlpha, hoverGrow } = MENU.flags;
  const langs: Lang[] = ['pl', 'en'];
  langs.forEach((lang, i) => {
    const active = getLang() === lang;
    const key = 'flag-' + lang + (active ? '' : '-gray');
    if (!scene.textures.exists(key)) return;
    const restAlpha = active ? 1 : inactiveAlpha;
    const flag = scene.add
      .image(left + size / 2 + i * (size + gap), TOP_BAR_CY, key)
      .setDisplaySize(size, size)
      .setAlpha(restAlpha)
      .setInteractive({ useHandCursor: true });
    flag.on('pointerover', () => flag.setAlpha(1).setDisplaySize(size + hoverGrow, size + hoverGrow));
    flag.on('pointerout', () => flag.setAlpha(restAlpha).setDisplaySize(size, size));
    flag.on('pointerdown', () => {
      if (getLang() === lang) return;
      gameAudio.uiClick();
      setLang(lang);
      scene.scene.restart();
    });
  });
}
