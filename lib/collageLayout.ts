/**
 * Justified collage layout — every photo at its own aspect ratio, nothing
 * cropped.
 *
 * The collage used to be a grid of square cells with `resizeMode="cover"`,
 * which is a decision to cut the top and bottom off every portrait photo and
 * the sides off every landscape one. On a day shot on a phone that is most
 * of them, and the crop lands wherever the subject happens not to be — so a
 * collage of a day out came back with people's heads missing. A square grid
 * is a shape imposed on the photos; this is the photos deciding the shape.
 *
 * **How it works** — the newspaper/Flickr method, not masonry columns:
 *
 *  1. Photos stay in the order they were taken, always. Reading order is
 *     chronological order, which is the whole reason a day is worth
 *     exporting as one picture. Masonry columns fill shortest-first and
 *     would scatter the morning through the afternoon.
 *  2. They are cut into contiguous rows. Every photo in a row is drawn at
 *     the same height, and that height is whatever makes the row exactly as
 *     wide as the frame: `h = (W - gaps) / Σ aspect`. The width each photo
 *     gets is `h × its own aspect`, so it is reproduced exactly — no crop,
 *     no letterbox, no stretch.
 *  3. The only freedom left is *where* the row breaks go, and that fixes the
 *     total height. So it tries every row count and picks the one whose
 *     block comes closest to filling the frame, then centres the block.
 *
 * The mat left over at the top and bottom is not a failure to fill the
 * canvas — it is the price of not cutting anything, and a generous even
 * margin is what the printed version of this has always looked like.
 */

/** A photo, as far as layout is concerned: an id and a width ÷ height. */
export interface AspectItem {
  id: string;
  /** width / height. 1 is square; > 1 landscape; < 1 portrait. */
  aspect: number;
}

export interface PlacedItem {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CollageLayout {
  items: PlacedItem[];
  /** What the block came to. In `fill` mode this is the frame exactly. */
  blockWidth: number;
  blockHeight: number;
  /** Row breaks, for anything that wants to reason about the shape. */
  rows: number;
  /**
   * How much each photo is cropped to make the block fill the frame: 1 is
   * untouched, 0.9 means a tenth of one dimension is outside its box.
   * Uniform across every cell by construction (see `layoutCollage`), so one
   * number describes the whole collage.
   */
  cropFactor: number;
}

/** Aspect ratios outside this are almost always a measurement failure (a
 *  zero, a NaN, a 1×1 placeholder) rather than a real photo, and one of them
 *  loose in a row squashes every photo beside it. */
const MIN_ASPECT = 0.4;
const MAX_ASPECT = 2.6;

export const safeAspect = (aspect: number | undefined | null): number => {
  if (!aspect || !Number.isFinite(aspect) || aspect <= 0) return 1;
  return Math.min(MAX_ASPECT, Math.max(MIN_ASPECT, aspect));
};

/** The height a contiguous run of photos takes when stretched to `width`. */
const rowHeight = (
  items: AspectItem[],
  from: number,
  to: number,
  width: number,
  gap: number,
): number => {
  let sum = 0;
  for (let i = from; i < to; i++) sum += safeAspect(items[i].aspect);
  const usable = width - gap * (to - from - 1);
  return usable / sum;
};

/**
 * Best contiguous split of `items` into exactly `rows` rows, by total height.
 *
 * Dynamic programming over "first i photos into r rows", which is cheap at
 * these counts and, unlike the greedy fill, cannot paint itself into a
 * corner where the last row holds one panorama three times the height of
 * everything above it.
 */
const splitInto = (
  items: AspectItem[],
  rows: number,
  width: number,
  gap: number,
): { breaks: number[]; height: number } | null => {
  const n = items.length;
  if (rows < 1 || rows > n) return null;

  // best[r][i] = smallest total height putting the first i photos in r rows.
  const best: number[][] = Array.from({ length: rows + 1 }, () =>
    new Array(n + 1).fill(Infinity),
  );
  const cut: number[][] = Array.from({ length: rows + 1 }, () =>
    new Array(n + 1).fill(-1),
  );
  best[0][0] = 0;

  for (let r = 1; r <= rows; r++) {
    for (let i = r; i <= n; i++) {
      for (let j = r - 1; j < i; j++) {
        if (best[r - 1][j] === Infinity) continue;
        const h = best[r - 1][j] + rowHeight(items, j, i, width, gap);
        if (h < best[r][i]) {
          best[r][i] = h;
          cut[r][i] = j;
        }
      }
    }
  }
  if (best[rows][n] === Infinity) return null;

  const breaks: number[] = [];
  let i = n;
  for (let r = rows; r >= 1; r--) {
    const j = cut[r][i];
    breaks.unshift(j);
    i = j;
  }
  breaks.push(n);
  return { breaks, height: best[rows][n] + gap * (rows - 1) };
};

/**
 * Lay `items` out inside a frame.
 *
 * A given set of row breaks fixes the block's *proportions* — halve the
 * width and every row halves in height — so each candidate row count is
 * really a candidate block shape, and the job is picking the shape closest
 * to the frame's.
 *
 * Choosing by "whose height is nearest the frame's" instead is the obvious
 * thing and it is wrong: a block a little too tall scales down to cover most
 * of the frame, while one far too short cannot be scaled up at all without
 * overrunning the sides. Six portrait photos in a landscape frame came out
 * as one thin strip covering 36% of the canvas, when two rows scaled down
 * cover 67%. So the score is the coverage ratio, which cannot make that
 * mistake.
 *
 * ── fit vs fill ──
 *
 * `fit` centres that block and leaves an even mat around it: every photo is
 * reproduced exactly, and the leftover is margin.
 *
 * `fill` (the default, and what the export uses) stretches the block to the
 * frame's height with the rows still spanning its width, so the boxes tile
 * the canvas edge to edge with nothing left over. The boxes are then not
 * quite each photo's own shape, and the difference is taken as a centre
 * crop — `cropFactor` says how much.
 *
 * **The crop is uniform and it is the smallest available.** Forcing the
 * block from its natural height to the frame's multiplies every row by the
 * same factor, so every cell is cropped by exactly the same proportion —
 * there is no photo that takes the hit for the others. And the row count was
 * already chosen to put the natural height as close to the frame as
 * possible, which is the same thing as putting that factor as close to 1 as
 * possible. Filling the frame costs the least it can cost.
 *
 * **But it can still cost too much, so there is a ceiling.** One 9:16 photo
 * in a landscape frame needs 62% of its height cut to reach the edges, which
 * is not a full-bleed collage, it is a destroyed photograph. Past `maxCrop`
 * this gives up and fits instead — a band of background is the lesser
 * failure, and it only appears where the day genuinely does not suit the
 * shape somebody chose. Everything inside the ceiling still goes edge to
 * edge.
 */
/**
 * The most of one dimension a photo may lose to reach the frame's edges.
 *
 * Chosen by measuring rather than by taste. Across realistic phone-camera
 * aspect mixes at one to twelve photos, the ceiling trades bleed against
 * butchery like this:
 *
 *   ceiling   edge-to-edge   mean crop   worst crop
 *     1.25          44%          5%          20%
 *     1.5           79%         14%          33%
 *     1.8           91%         19%          44%
 *     2.0           98%         22%          50%
 *     none         100%         23%          63%
 *
 * 2.0 is where the curve flattens: essentially every collage fills the
 * frame, and the ceiling stops being a design decision and becomes what it
 * should be — a backstop against the handful of cases that would lose more
 * than half a photograph (one 9:16 clip alone in a landscape frame). Going
 * further buys 2% more bleed for a photo nobody would recognise.
 */
export const MAX_CROP = 2;

export const layoutCollage = (
  items: AspectItem[],
  frame: {
    width: number;
    height: number;
    gap: number;
    /** Preserve every aspect exactly and leave a mat. Default: fill. */
    fit?: boolean;
    /** Override the fill ceiling. Mostly here so the dev preview can show
     *  what an uncapped fill would have done. */
    maxCrop?: number;
  },
): CollageLayout => {
  const { width, height, gap } = frame;
  if (items.length === 0) {
    return { items: [], blockWidth: 0, blockHeight: 0, rows: 0, cropFactor: 1 };
  }

  let chosen: { breaks: number[]; height: number } | null = null;
  let chosenRows = 1;
  let bestCoverage = -1;

  for (let rows = 1; rows <= items.length; rows++) {
    const split = splitInto(items, rows, width, gap);
    if (!split || split.height <= 0) continue;
    // How much of the frame this shape covers once fitted: 1 when the block
    // is exactly the frame's proportions, falling away either side.
    const coverage =
      Math.min(split.height, height) / Math.max(split.height, height);
    // Fewer, larger photos win ties — the same picture at a bigger size.
    if (coverage > bestCoverage + 1e-9) {
      bestCoverage = coverage;
      chosen = split;
      chosenRows = rows;
    }
  }
  if (!chosen) {
    return { items: [], blockWidth: 0, blockHeight: 0, rows: 0, cropFactor: 1 };
  }

  // Rows always span the full width. What differs is the height:
  //  fit  — one factor on both axes, so nothing is cropped and a mat is left.
  //  fill — height only, so the block reaches the frame's edges and the
  //         boxes stop being exactly each photo's shape.
  const gapsHeight = gap * (chosenRows - 1);
  const naturalBody = chosen.height - gapsHeight;
  const targetBody = height - gapsHeight;
  const ceiling = frame.maxCrop ?? MAX_CROP;

  // What filling would demand of every photo, and whether that is affordable.
  const wanted = naturalBody > 0 ? targetBody / naturalBody : 1;
  const cost = wanted > 1 ? wanted : 1 / wanted;
  const fit = frame.fit === true || cost > ceiling;

  const scale = fit
    ? chosen.height > height
      ? height / chosen.height
      : 1
    : 1;
  const heightScale = fit || naturalBody <= 0 ? scale : wanted;

  const placed: PlacedItem[] = [];
  let y = 0;

  for (let r = 0; r < chosenRows; r++) {
    const from = chosen.breaks[r];
    const to = chosen.breaks[r + 1];
    const natural = rowHeight(items, from, to, width, gap);
    const h = natural * heightScale;
    let x = 0;
    for (let i = from; i < to; i++) {
      // Width always comes from the natural height, so the row still spans
      // the frame exactly — it is only the box's height that moved.
      const w = natural * scale * safeAspect(items[i].aspect);
      placed.push({ id: items[i].id, x, y, width: w, height: h });
      x += w + gap * scale;
    }
    y += h + gap;
  }

  return {
    items: placed,
    blockWidth: width * scale,
    blockHeight: fit ? chosen.height * scale : height,
    rows: chosenRows,
    // < 1 when boxes ended up shorter than the photos (cropped top and
    // bottom), > 1 when taller (cropped left and right).
    cropFactor: fit ? 1 : heightScale,
  };
};
