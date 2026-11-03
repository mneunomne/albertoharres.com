import { LinearFilter, LinearMipmapLinearFilter } from "three";
import SpriteText from "three-spritetext";

// three-spritetext rasterises each label at a fixed 90px font and samples the
// resulting texture with plain bilinear filtering and no mipmaps. When the
// camera sits far back (small windows, mobile) that texture is minified to a
// dozen pixels and most texels get skipped, so the text looks ragged.
//
// This subclass re-applies trilinear mipmapping + anisotropy every time the
// texture is (re)generated — including after later property changes such as
// `backgroundColor`, which rebuild the canvas and would otherwise reset the
// filters back to the library defaults.
export default class CrispSpriteText extends SpriteText {
  _genCanvas() {
    super._genCanvas();
    const texture = this.material && this.material.map;
    if (!texture) return;
    texture.generateMipmaps = true;
    texture.minFilter = LinearMipmapLinearFilter;
    texture.magFilter = LinearFilter;
    // three clamps this to the GPU's max supported value.
    texture.anisotropy = 8;
    texture.needsUpdate = true;
  }
}
