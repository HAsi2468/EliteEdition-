export const COLOR_NAMES = [
  "Black", "White", "Grey", "Charcoal", "Cream", "Beige", "Ivory", "Khaki", "Tan", "Brown",
  "Chocolate", "Red", "Crimson", "Maroon", "Burgundy", "Ruby", "Rose", "Pink", "Magenta", "Plum",
  "Purple", "Lavender", "Violet", "Indigo", "Blue", "Navy", "Royal Blue", "Sky Blue", "Teal", "Cyan",
  "Turquoise", "Aquamarine", "Green", "Olive", "Lime", "Mint", "Emerald", "Sage", "Forest Green", "Yellow",
  "Mustard", "Gold", "Orange", "Peach", "Coral", "Salmon", "Bronze", "Silver", "Copper", "Rust",
  "Apricot", "Lilac", "Mauve", "Fuchsia", "Wine", "Cherry", "Terracotta", "Camel", "Taupe", "Sand",
  "Champagne", "Pistachio", "Avocado", "Olive Green", "Khaki Green", "Sea Green", "Ocean Blue", "Slate Blue", "Midnight Blue", "Denim",
  "Powder Blue", "Lavender Blue", "Amethyst", "Orchid", "Mulberry", "Aubergine", "Violet Red", "Coral Pink", "Dusty Pink", "Blush",
  "Hot Pink", "Scarlet", "Rust Orange", "Burnt Orange", "Amber", "Tangerine", "Lemon", "Canary Yellow", "Saffron", "Creamy Yellow"
];

export const COLOR_MAP = {
  "Black": "#000000",
  "White": "#FFFFFF",
  "Grey": "#808080",
  "Charcoal": "#36454F",
  "Cream": "#FFFDD0",
  "Beige": "#F5F5DC",
  "Ivory": "#FFFFF0",
  "Khaki": "#F0E68C",
  "Tan": "#D2B48C",
  "Brown": "#964B00",
  "Chocolate": "#7B3F00",
  "Red": "#FF0000",
  "Crimson": "#DC143C",
  "Maroon": "#800000",
  "Burgundy": "#800020",
  "Ruby": "#E0115F",
  "Rose": "#FF007F",
  "Pink": "#FFC0CB",
  "Magenta": "#FF00FF",
  "Plum": "#8E4585",
  "Purple": "#800080",
  "Lavender": "#E6E6FA",
  "Violet": "#8F00FF",
  "Indigo": "#4B0082",
  "Blue": "#0000FF",
  "Navy": "#000080",
  "Royal Blue": "#4169E1",
  "Sky Blue": "#87CEEB",
  "Teal": "#008080",
  "Cyan": "#00FFFF",
  "Turquoise": "#40E0D0",
  "Aquamarine": "#7FFFD4",
  "Green": "#008000",
  "Olive": "#808000",
  "Lime": "#00FF00",
  "Mint": "#98FF98",
  "Emerald": "#50C878",
  "Sage": "#BCB88A",
  "Forest Green": "#228B22",
  "Yellow": "#FFFF00",
  "Mustard": "#FFDB58",
  "Gold": "#FFD700",
  "Orange": "#FFA500",
  "Peach": "#FFDAB9",
  "Coral": "#FF7F50",
  "Salmon": "#FA8072",
  "Bronze": "#CD7F32",
  "Silver": "#C0C0C0",
  "Copper": "#B87333",
  "Rust": "#B7410E",
  "Apricot": "#FBCEB1",
  "Lilac": "#C8A2C8",
  "Mauve": "#E0B0FF",
  "Fuchsia": "#FF00FF",
  "Wine": "#722F37",
  "Cherry": "#D2042D",
  "Terracotta": "#E2725B",
  "Camel": "#C19A6B",
  "Taupe": "#483C32",
  "Sand": "#C2B280",
  "Champagne": "#F7E7CE",
  "Pistachio": "#93C572",
  "Avocado": "#568203",
  "Olive Green": "#B5B35C",
  "Khaki Green": "#8A865D",
  "Sea Green": "#2E8B57",
  "Ocean Blue": "#0077BE",
  "Slate Blue": "#6A5ACD",
  "Midnight Blue": "#191970",
  "Denim": "#1560BD",
  "Powder Blue": "#B0E0E6",
  "Lavender Blue": "#8B89F8",
  "Amethyst": "#9966CC",
  "Orchid": "#DA70D6",
  "Mulberry": "#C54B8C",
  "Aubergine": "#3D0734",
  "Violet Red": "#F75D59",
  "Coral Pink": "#F88379",
  "Dusty Pink": "#D58A94",
  "Blush": "#DE5D83",
  "Hot Pink": "#FF69B4",
  "Scarlet": "#FF2400",
  "Rust Orange": "#C35214",
  "Burnt Orange": "#CC5500",
  "Amber": "#FFBF00",
  "Tangerine": "#F28500",
  "Lemon": "#FFF700",
  "Canary Yellow": "#FFEF00",
  "Saffron": "#F4C430",
  "Creamy Yellow": "#FFFDD0"
};

// Case-insensitive lookup helper
export function getColorHex(colorName) {
  if (!colorName) return null;
  const nameClean = colorName.trim();
  
  // Direct match
  if (COLOR_MAP[nameClean]) {
    return COLOR_MAP[nameClean];
  }
  
  // Case-insensitive match
  const lowerName = nameClean.toLowerCase();
  const match = Object.keys(COLOR_MAP).find(k => k.toLowerCase() === lowerName);
  if (match) {
    return COLOR_MAP[match];
  }
  
  // Fallback: If it starts with # and is a valid hex, return it
  if (nameClean.startsWith('#') && (nameClean.length === 4 || nameClean.length === 7)) {
    return nameClean;
  }
  
  // Default fallback (e.g. check if it's a standard web color, otherwise return null)
  return null;
}

/**
 * Convert hex color string to RGB object
 */
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

/**
 * Convert RGB (0-255) to HSV (h: 0-360, s: 0-1, v: 0-1)
 */
function rgbToHsv(r, g, b) {
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;

  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  const d = max - min;

  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max;

  if (max !== min) {
    switch (max) {
      case rNorm: h = (gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0); break;
      case gNorm: h = (bNorm - rNorm) / d + 2; break;
      case bNorm: h = (rNorm - gNorm) / d + 4; break;
    }
    h /= 6;
  }

  return { h: Math.round(h * 360), s, v };
}

/**
 * Perceptual Red-Mean color distance (human visual perception model)
 */
function perceptualColorDistance(c1, c2) {
  const rMean = (c1.r + c2.r) / 2;
  const dr = c1.r - c2.r;
  const dg = c1.g - c2.g;
  const db = c1.b - c2.b;
  return Math.sqrt((2 + rMean / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rMean) / 256) * db * db);
}

/**
 * Find the closest predefined fabric color name using perceptual distance
 */
function findClosestColorName(rgb) {
  let minDist = Infinity;
  let closest = 'White';

  for (const [name, hex] of Object.entries(COLOR_MAP)) {
    const mapRgb = hexToRgb(hex);
    if (!mapRgb) continue;
    const dist = perceptualColorDistance(rgb, mapRgb);
    if (dist < minDist) {
      minDist = dist;
      closest = name;
    }
  }
  return closest;
}

/**
 * Detect dominant color(s) from an image source (base64 data URL or http/https URL).
 * Uses Advanced Perceptual HSV Analysis with background canvas filtering.
 * 
 * @param {string} imageSrc - base64 data URL or image URL
 * @param {number} topN - number of dominant colors to return (default 3)
 * @returns {Promise<Array<{name: string, hex: string, percentage: number}>>}
 */
export function detectDominantColors(imageSrc, topN = 3) {
  return new Promise((resolve, reject) => {
    if (!imageSrc) {
      reject(new Error('No image source provided'));
      return;
    }

    const img = new window.Image();
    if (!imageSrc.startsWith('data:')) {
      img.crossOrigin = 'Anonymous';
    }

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const size = 120;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, size, size);

        const imageData = ctx.getImageData(0, 0, size, size);
        const pixels = imageData.data;

        // Step 1: Analyze pixels and filter out background/margin paper noise
        const validPixels = [];
        let backgroundCount = 0;

        for (let i = 0; i < pixels.length; i += 4) {
          const r = pixels[i];
          const g = pixels[i + 1];
          const b = pixels[i + 2];
          const a = pixels[i + 3];

          if (a < 128) continue; // Skip transparent

          const hsv = rgbToHsv(r, g, b);
          const isWhiteBackground = r > 235 && g > 235 && b > 235;
          const isNearWhiteCanvas = hsv.v > 0.90 && hsv.s < 0.08;
          const isExtremeBlackMargin = hsv.v < 0.05;

          if (isWhiteBackground || isNearWhiteCanvas || isExtremeBlackMargin) {
            backgroundCount++;
          } else {
            validPixels.push({ r, g, b, hsv });
          }
        }

        // If design contains artwork pixels (>5% of total), analyze artwork pixels.
        // Otherwise, fall back to analyzing all non-transparent pixels.
        const pixelsToAnalyze = validPixels.length > (pixels.length / 4) * 0.05 ? validPixels : [];
        if (pixelsToAnalyze.length === 0) {
          for (let i = 0; i < pixels.length; i += 4) {
            const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2], a = pixels[i + 3];
            if (a >= 128) pixelsToAnalyze.push({ r, g, b, hsv: rgbToHsv(r, g, b) });
          }
        }

        if (pixelsToAnalyze.length === 0) {
          resolve([{ name: 'White', hex: '#FFFFFF', percentage: 100 }]);
          return;
        }

        // Step 2: Quantize artwork pixels into HSV / RGB buckets & weight by saturation
        const buckets = {};
        let totalWeight = 0;

        for (const p of pixelsToAnalyze) {
          // Quantize RGB to 16-level buckets
          const qr = Math.round(p.r / 16) * 16;
          const qg = Math.round(p.g / 16) * 16;
          const qb = Math.round(p.b / 16) * 16;
          const key = `${qr},${qg},${qb}`;

          // Give extra weight to saturated colors so design patterns are prioritized over pale backgrounds
          const weight = 1.0 + (p.hsv.s * 2.5);

          if (!buckets[key]) {
            buckets[key] = { r: 0, g: 0, b: 0, weight: 0, count: 0 };
          }
          buckets[key].r += p.r * weight;
          buckets[key].g += p.g * weight;
          buckets[key].b += p.b * weight;
          buckets[key].weight += weight;
          buckets[key].count += 1;
          totalWeight += weight;
        }

        // Step 3: Sort buckets by weighted dominance
        const sorted = Object.values(buckets).sort((a, b) => b.weight - a.weight);

        // Step 4: Map dominant clusters to closest predefined textile colors
        const results = [];
        const usedNames = new Set();

        for (const bucket of sorted) {
          if (results.length >= topN) break;

          const avgRgb = {
            r: Math.round(bucket.r / bucket.weight),
            g: Math.round(bucket.g / bucket.weight),
            b: Math.round(bucket.b / bucket.weight)
          };

          const name = findClosestColorName(avgRgb);
          if (usedNames.has(name)) continue;
          usedNames.add(name);

          const percentage = Math.round((bucket.weight / totalWeight) * 100);
          results.push({
            name,
            hex: COLOR_MAP[name] || '#000000',
            percentage
          });
        }

        resolve(results.length > 0 ? results : [{ name: 'White', hex: '#FFFFFF', percentage: 100 }]);
      } catch (err) {
        reject(new Error('Failed to analyze image pixels: ' + err.message));
      }
    };

    img.onerror = () => {
      reject(new Error('Failed to load image. If using a Google Drive link, try uploading the file directly instead.'));
    };

    img.src = imageSrc;
  });
}
