/**
 * content.js — the SINGLE content loader for Color by Number.
 *
 * Bundled starter canvases and (from Phase 5) downloaded packages pass through
 * exactly the same load + validate path (spec §2, AC-11). The engine never
 * contains picture-specific logic.
 *
 * Phase 1 scope: bundled starter content only. Download support lands in Phase 5.
 */

import { validateCanvasManifest, validateCatalog, sanitizeSVG } from "./validate.js";
import { dbPut, dbGet } from "./db.js";

const BUNDLED_CATALOG_URL = "content/catalog.json";
const STARTER_BASE_URL = "content/starter";

let bundledCatalog = null;

async function fetchJSON(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to load ${url}: HTTP ${response.status}`);
  return response.json();
}

async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to load ${url}: HTTP ${response.status}`);
  return response.text();
}

/**
 * Load the bundled catalog (the starter library list). Validates the schema,
 * keeps a copy in the `catalog` store under key 'bundled', and returns it.
 */
export async function loadBundledCatalog() {
  if (bundledCatalog) return bundledCatalog;
  const catalog = await fetchJSON(BUNDLED_CATALOG_URL);
  validateCatalog(catalog);
  bundledCatalog = catalog;
  try {
    await dbPut("catalog", { key: "bundled", catalog, fetchedAt: new Date().toISOString() });
  } catch (error) {
    // Catalog storage is a convenience, not a startup blocker.
    console.warn("Could not store bundled catalog in IndexedDB:", error);
  }
  return catalog;
}

/** The bundled catalog as stored in IndexedDB, if a previous run saved it. */
export async function getStoredBundledCatalog() {
  const row = await dbGet("catalog", "bundled");
  return row ? row.catalog : null;
}

/**
 * Load one bundled starter canvas through the full validation path:
 * fetch manifest -> validate manifest -> fetch SVG -> sanitise SVG and check
 * the region/palette mapping. Returns { manifest, svg, regionCount, regionIds }.
 */
export async function loadCanvas(canvasId) {
  const base = `${STARTER_BASE_URL}/${canvasId}`;
  const manifest = await fetchJSON(`${base}/manifest.json`);
  validateCanvasManifest(manifest);
  if (manifest.id !== canvasId) {
    throw new Error(`Manifest id ${manifest.id} does not match requested canvas ${canvasId}`);
  }
  const svgText = await fetchText(`${base}/${manifest.artwork}`);
  const paletteNumbers = manifest.palette.map((entry) => entry.number);
  const checked = sanitizeSVG(svgText, paletteNumbers);
  return { manifest, svg: checked.svg, regionCount: checked.regionCount, regionIds: checked.regionIds };
}

/** URL of a canvas thumbnail (bundled starter content). */
export function thumbnailURL(canvasId) {
  return `${STARTER_BASE_URL}/${canvasId}/thumbnail.svg`;
}

/**
 * The starter gallery list: one entry per bundled canvas, with title, category,
 * difficulty, palette size, region count is left to loadCanvas (kept light here).
 */
export async function getStarterCanvases() {
  const catalog = await loadBundledCatalog();
  return catalog.packages
    .filter((pkg) => pkg.kind === "canvas")
    .map((pkg) => ({
      id: pkg.id,
      title: pkg.title,
      category: pkg.category,
      version: pkg.version,
      sizeBytes: pkg.sizeBytes,
      thumbnail: thumbnailURL(pkg.id),
    }));
}
