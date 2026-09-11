/**
 * Does this price make any sense for this thing?
 *
 * A car listed at Nu 100 is nearly always a typo, a placeholder somebody
 * meant to come back to, or a bait listing — and it is the buyer who wastes
 * the trip. So the listing forms read the words the seller has already
 * typed, work out roughly what is being sold, and say whether the price is
 * anywhere near the range that kind of thing goes for here.
 *
 * **Rough on purpose.** These bands are deliberately wide — wide enough that
 * a scrap car and a new Prado are both inside the car band — because the
 * cost of a wrong warning is far higher than the cost of a missed one. A
 * seller nagged about a price that was right stops reading the form; a
 * seller warned about the price that was wrong fixes it. Nothing here
 * blocks a listing: the seller always knows more about their own thing than
 * a keyword table does.
 *
 * **It says nothing unless it is sure.** No keyword match, an accessory word
 * anywhere in the text, a "free" or "swap" listing — all return no opinion
 * at all. Silence is the correct output most of the time.
 *
 * Everything is in Ngultrum. Bands are for Bhutan and are meant to be
 * revised as prices move; they are one table in one file for exactly that
 * reason.
 */

export type PriceContext = "sale" | "rent" | "salary";

export interface PriceBand {
  key: string;
  /** How the message names it: "a car", "a phone". */
  label: string;
  min: number;
  max: number;
}

export interface PriceCheck {
  band: PriceBand | null;
  verdict: "ok" | "low" | "high" | "unknown";
  /** Ready to show under the field, or null when there is nothing to say. */
  message: string | null;
}

type BandRule = {
  key: string;
  label: string;
  /** Whole words, matched case-insensitively against title + description. */
  words: string[];
  sale: [number, number];
  /** Monthly, where renting the thing is a normal listing. */
  rent?: [number, number];
};

/**
 * Words that mean "a part or an accessory for one of these", not the thing
 * itself. A phone case is not a phone and costs a hundredth as much, and
 * warning about it is the single most likely way this feature becomes noise.
 * Any of these anywhere in the text switches the check off entirely.
 */
const ACCESSORY_WORDS = [
  "case", "cover", "charger", "cable", "adapter", "adaptor", "screen guard",
  "screen protector", "tempered", "spare", "spares", "part", "parts",
  "accessory", "accessories", "sticker", "decal", "mat", "seat cover",
  "tyre", "tire", "wiper", "mirror", "bulb", "battery", "strap", "band",
  "stand", "holder", "mount", "pouch", "bag for", "repair", "service for",
  "toy", "miniature", "model car", "keychain", "key chain", "poster",
];

/**
 * Most specific first — "power tiller" has to win over "tiller", and
 * "bicycle" over "bike", or the wrong band answers.
 */
const BANDS: BandRule[] = [
  {
    key: "land",
    label: "land or a property",
    words: ["land", "plot", "acre", "decimal", "house", "building", "apartment",
            "flat", "godown", "shop space", "warehouse"],
    sale: [200_000, 200_000_000],
    rent: [1_500, 250_000],
  },
  {
    key: "car",
    label: "a car",
    words: ["car", "sedan", "suv", "hatchback", "pickup", "truck", "bolero",
            "hilux", "prado", "alto", "swift", "wagonr", "wagon r", "santro",
            "i10", "i20", "creta", "fortuner", "jeep", "taxi", "van",
            "vehicle", "bus", "excavator", "tipper"],
    sale: [40_000, 8_000_000],
    rent: [500, 300_000],
  },
  {
    key: "motorbike",
    label: "a motorbike",
    words: ["motorbike", "motorcycle", "scooter", "scooty", "pulsar", "enfield",
            "bullet", "activa", "dirt bike", "moped"],
    sale: [15_000, 1_500_000],
  },
  {
    key: "bicycle",
    label: "a bicycle",
    words: ["bicycle", "cycle", "mtb", "mountain bike", "road bike", "bmx"],
    sale: [1_500, 500_000],
  },
  {
    key: "phone",
    label: "a phone",
    words: ["phone", "smartphone", "iphone", "galaxy", "redmi", "oppo", "vivo",
            "realme", "pixel", "oneplus", "mobile"],
    sale: [1_500, 300_000],
  },
  {
    key: "laptop",
    label: "a laptop or computer",
    words: ["laptop", "macbook", "ultrabook", "chromebook", "computer",
            "desktop", "imac", "cpu tower"],
    sale: [6_000, 600_000],
  },
  {
    key: "tablet",
    label: "a tablet",
    words: ["ipad", "tablet"],
    sale: [3_000, 300_000],
  },
  {
    key: "tv",
    label: "a television",
    words: ["television", "tv", "smart tv", "led tv", "oled"],
    sale: [3_000, 500_000],
  },
  {
    key: "appliance",
    label: "an appliance",
    words: ["fridge", "refrigerator", "washing machine", "air conditioner",
            "microwave", "oven", "water heater", "geyser", "rice cooker",
            "curry cooker", "blender", "freezer", "dishwasher"],
    sale: [1_500, 300_000],
  },
  {
    key: "camera",
    label: "a camera",
    words: ["camera", "dslr", "mirrorless", "gopro", "camcorder", "drone"],
    sale: [3_000, 900_000],
  },
  {
    key: "audio",
    label: "audio gear",
    words: ["speaker", "headphone", "headphones", "earbuds", "airpods",
            "soundbar", "amplifier"],
    sale: [200, 150_000],
  },
  {
    key: "console",
    label: "a games console",
    words: ["playstation", "ps4", "ps5", "xbox", "nintendo", "switch console"],
    sale: [5_000, 250_000],
  },
  {
    key: "machinery",
    label: "machinery",
    words: ["generator", "power tiller", "tiller", "chainsaw", "welding",
            "compressor", "lathe", "grinder", "drill machine"],
    sale: [1_000, 1_500_000],
  },
  {
    key: "cattle",
    label: "cattle",
    words: ["cow", "jersey", "bull", "ox", "oxen", "calf", "heifer", "yak",
            "buffalo"],
    sale: [10_000, 600_000],
  },
  {
    key: "horse",
    label: "a horse",
    words: ["horse", "pony", "mule", "donkey"],
    sale: [15_000, 600_000],
  },
  {
    key: "smallstock",
    label: "livestock",
    words: ["goat", "sheep", "pig", "piglet", "sow", "boar"],
    sale: [1_500, 200_000],
  },
  {
    key: "poultry",
    label: "poultry",
    words: ["chicken", "hen", "rooster", "duck", "poultry", "chicks", "turkey"],
    sale: [80, 8_000],
  },
  {
    key: "pet",
    label: "a pet",
    words: ["puppy", "kitten", "parrot", "aquarium"],
    sale: [200, 200_000],
  },
  {
    key: "jewellery",
    label: "jewellery",
    words: ["gold", "silver", "jewellery", "jewelry", "necklace", "bangle",
            "earring", "earrings", "pendant", "coral", "turquoise", "dzi",
            "zee bead"],
    sale: [300, 10_000_000],
  },
  {
    key: "textile",
    label: "handwoven cloth",
    words: ["kira", "gho", "tego", "wonju", "kabney", "rachu", "yathra",
            "handwoven", "hand woven", "raw silk", "bura"],
    sale: [500, 1_500_000],
  },
  {
    key: "furniture",
    label: "furniture",
    words: ["sofa", "mattress", "wardrobe", "cupboard", "almirah",
            "dining table", "dressing table", "bed frame", "bunk bed",
            "office chair", "shelf", "bookshelf"],
    sale: [500, 400_000],
  },
  {
    key: "clothing",
    label: "clothing",
    words: ["shoes", "sneakers", "boots", "jacket", "jeans", "t-shirt",
            "tshirt", "hoodie", "dress", "saree", "kurta", "trousers"],
    sale: [100, 100_000],
  },
  {
    key: "food",
    label: "food",
    words: ["rice", "chilli", "chili", "potato", "onion", "vegetable",
            "vegetables", "cheese", "datshi", "honey", "eggs", "butter",
            "maize", "flour", "oil packet"],
    sale: [20, 50_000],
  },
  {
    key: "books",
    label: "books or stationery",
    words: ["book", "books", "textbook", "novel", "stationery", "notebook set"],
    sale: [20, 20_000],
  },
];

/** A salary is not a price, so it gets its own band and ignores keywords —
 *  a job advert says what the *job* is, and every job is paid monthly. */
const SALARY_BAND: PriceBand = {
  key: "salary",
  label: "a monthly salary",
  min: 2_000,
  max: 500_000,
};

/** Renting something we do not otherwise recognise. Wide, because it covers
 *  a room, a shop and a marquee alike. */
const GENERIC_RENT_BAND: PriceBand = {
  key: "rent",
  label: "a monthly rent",
  min: 300,
  max: 300_000,
};

const hasWord = (haystack: string, word: string) => {
  // Escaped, because a rule may legitimately contain "." or "-".
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(haystack);
};

export const formatNu = (value: number) => `Nu ${Math.round(value).toLocaleString()}`;

/**
 * What the seller is selling, as far as their own words give it away.
 * Exported so a form can show the band before a price is even typed.
 */
export const detectPriceBand = (
  text: string,
  context: PriceContext = "sale",
): PriceBand | null => {
  const haystack = ` ${text.toLowerCase()} `;
  if (!haystack.trim()) return null;
  if (context === "salary") return SALARY_BAND;

  // A part or an accessory for the thing is not the thing.
  if (ACCESSORY_WORDS.some((w) => hasWord(haystack, w))) return null;

  for (const rule of BANDS) {
    if (!rule.words.some((w) => hasWord(haystack, w))) continue;
    const range = context === "rent" ? (rule.rent ?? null) : rule.sale;
    if (!range) return context === "rent" ? GENERIC_RENT_BAND : null;
    return { key: rule.key, label: rule.label, min: range[0], max: range[1] };
  }
  return context === "rent" ? GENERIC_RENT_BAND : null;
};

/**
 * The advisory for a price, or nothing at all.
 *
 * `price` of 0 or NaN returns nothing: an empty field is not a mistake yet,
 * and a genuinely free listing is a different kind of row.
 */
export const checkPrice = ({
  text,
  price,
  context = "sale",
}: {
  /** Title, description, category, tags — whatever the seller has typed. */
  text: string;
  price: number;
  context?: PriceContext;
}): PriceCheck => {
  const band = detectPriceBand(text, context);
  if (!band || !Number.isFinite(price) || price <= 0) {
    return { band, verdict: "unknown", message: null };
  }
  if (price < band.min) {
    return {
      band,
      verdict: "low",
      message: `${formatNu(price)} looks low for ${band.label} — most are between ${formatNu(band.min)} and ${formatNu(band.max)}. Post it anyway if that is right.`,
    };
  }
  if (price > band.max) {
    return {
      band,
      verdict: "high",
      message: `${formatNu(price)} looks high for ${band.label} — most are between ${formatNu(band.min)} and ${formatNu(band.max)}. Post it anyway if that is right.`,
    };
  }
  return { band, verdict: "ok", message: null };
};
