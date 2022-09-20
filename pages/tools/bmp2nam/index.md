
### bmp2nam

https://raw.githubusercontent.com/LexouDuck/bmp2nam/master/README.md

Here is a quick but pretty detailed summary of graphical limitations on the NES:
- 2 types of graphics: "sprites" (which can be freely placed anywhere onscreen or offscreen) and "tiles" (which must be positioned aligned to the background tile grid)
- sprites can be 8x8 pixels in size (or 8x16 in certain cases)
- 4 colors per sprite (first of which is the transparent color, so 3 usable colors really)
- groups of 8x8 sprites area assembled into larger "meta-sprites"
- tiles are 8x8 pixels in size
- groups of tiles in a 2x2 tile layout form a 16x16 pixel "meta-tile"
- 4 colors per meta-tile (i.e. a 16x16 square of background)
- there are 8 palettes (of 4 colors each): 4 palettes for sprites, and 4 palettes for tiles
- only 64 sprites (not meta-sprites) can be drawn on the screen (can be "solved" using flickering)
- only the 8 first sprites of any horizontal scanline will be drawn (can be "solved" using flickering)
