/**
 * validate.js — schema validation, SVG sanitising, SHA-256.
 *
 * This is the ONE validation path for all content: bundled starter canvases and
 * downloaded packages alike (spec §6, AC-11). Anything that fails here is never
 * rendered and never installed.
 */

export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ValidationError";
  }
}

const ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const SEMVER_RE = /^\d+\.\d+\.\d+$/;
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const SHA256_RE = /^[0-9a-f]{64}$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

function fail(message) {
  throw new ValidationError(message);
}

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function checkString(obj, field, { required = true, pattern = null } = {}) {
  const v = obj[field];
  if (v === undefined || v === null) {
    if (required) fail(`Missing required field: ${field}`);
    return;
  }
  if (typeof v !== "string" || v.trim() === "") {
    fail(`Field ${field} must be a non-empty string`);
  }
  if (pattern && !pattern.test(v)) fail(`Field ${field} has an invalid value: ${v}`);
}

function checkInt(obj, field, { required = true, min = null } = {}) {
  const v = obj[field];
  if (v === undefined || v === null) {
    if (required) fail(`Missing required field: ${field}`);
    return;
  }
  if (!Number.isInteger(v)) fail(`Field ${field} must be an integer`);
  if (min !== null && v < min) fail(`Field ${field} must be >= ${min}`);
}

/**
 * Validate a canvas manifest (spec §6). Returns true; throws ValidationError.
 */
export function validateCanvasManifest(manifest) {
  if (!isPlainObject(manifest)) fail("Canvas manifest must be an object");
  if (manifest.schemaVersion !== 1) {
    fail(`Unsupported canvas schemaVersion: ${manifest.schemaVersion}`);
  }
  checkString(manifest, "id", { pattern: ID_RE });
  checkInt(manifest, "version", { min: 1 });
  checkString(manifest, "title");
  checkString(manifest, "description", { required: false });
  checkString(manifest, "category");
  if (!Array.isArray(manifest.tags)) fail("Field tags must be an array");
  if (!["easy", "medium", "hard"].includes(manifest.difficulty)) {
    fail(`Field difficulty must be easy, medium or hard, got: ${manifest.difficulty}`);
  }
  if (manifest.packId !== undefined) checkString(manifest, "packId", { pattern: ID_RE });
  checkString(manifest, "thumbnail");
  checkString(manifest, "artwork");
  if (manifest.completedArt !== undefined) checkString(manifest, "completedArt");
  if (!Array.isArray(manifest.palette) || manifest.palette.length === 0) {
    fail("Field palette must be a non-empty array");
  }
  const numbers = new Set();
  for (const entry of manifest.palette) {
    if (!isPlainObject(entry)) fail("Palette entries must be objects");
    if (!Number.isInteger(entry.number) || entry.number < 1) {
      fail("Palette numbers must be positive integers");
    }
    if (numbers.has(entry.number)) fail(`Duplicate palette number: ${entry.number}`);
    numbers.add(entry.number);
    if (typeof entry.color !== "string" || !HEX_COLOR_RE.test(entry.color)) {
      fail(`Palette color must be a #RRGGBB hex value, got: ${entry.color}`);
    }
    if (entry.name !== undefined && typeof entry.name !== "string") {
      fail("Palette name must be a string");
    }
  }
  checkString(manifest, "minimumGameVersion", { pattern: SEMVER_RE });
  checkInt(manifest, "sizeBytes", { min: 1 });
  checkString(manifest, "updatedAt", { pattern: ISO_DATE_RE });
  if (manifest.sha256 !== undefined) {
    checkString(manifest, "sha256", { pattern: SHA256_RE });
  }
  return true;
}

/**
 * Validate a pack manifest (spec §6). Returns true; throws ValidationError.
 */
export function validatePackManifest(manifest) {
  if (!isPlainObject(manifest)) fail("Pack manifest must be an object");
  if (manifest.schemaVersion !== 1) {
    fail(`Unsupported pack schemaVersion: ${manifest.schemaVersion}`);
  }
  checkString(manifest, "id", { pattern: ID_RE });
  checkInt(manifest, "version", { min: 1 });
  checkString(manifest, "title");
  checkString(manifest, "description", { required: false });
  checkString(manifest, "category");
  if (!Array.isArray(manifest.tags)) fail("Field tags must be an array");
  checkString(manifest, "cover");
  if (!Array.isArray(manifest.canvases) || manifest.canvases.length === 0) {
    fail("Field canvases must be a non-empty array of canvas IDs");
  }
  for (const id of manifest.canvases) {
    if (typeof id !== "string" || !ID_RE.test(id)) fail(`Invalid canvas ID in pack: ${id}`);
  }
  if (manifest.canvasCount !== undefined) {
    checkInt(manifest, "canvasCount", { min: 1 });
    if (manifest.canvasCount !== manifest.canvases.length) {
      fail("Field canvasCount does not match the canvases list length");
    }
  }
  checkString(manifest, "minimumGameVersion", { pattern: SEMVER_RE });
  checkInt(manifest, "sizeBytes", { min: 1 });
  checkString(manifest, "updatedAt", { pattern: ISO_DATE_RE });
  if (manifest.sha256 !== undefined) {
    checkString(manifest, "sha256", { pattern: SHA256_RE });
  }
  return true;
}

/**
 * Validate a remote/bundled catalog (spec §7). Returns true; throws ValidationError.
 */
export function validateCatalog(catalog) {
  if (!isPlainObject(catalog)) fail("Catalog must be an object");
  if (catalog.schemaVersion !== 1) {
    fail(`Unsupported catalog schemaVersion: ${catalog.schemaVersion}`);
  }
  checkInt(catalog, "catalogVersion", { min: 1 });
  checkString(catalog, "updatedAt", { pattern: ISO_DATE_RE });
  if (!Array.isArray(catalog.packages)) fail("Field packages must be an array");
  for (const pkg of catalog.packages) {
    if (!isPlainObject(pkg)) fail("Catalog packages must be objects");
    if (!["canvas", "pack"].includes(pkg.kind)) {
      fail(`Catalog package kind must be canvas or pack, got: ${pkg.kind}`);
    }
    checkString(pkg, "id", { pattern: ID_RE });
    checkInt(pkg, "version", { min: 1 });
    checkString(pkg, "title");
    checkString(pkg, "category");
    checkInt(pkg, "sizeBytes", { min: 1 });
    checkString(pkg, "sha256", { pattern: SHA256_RE });
    checkString(pkg, "downloadPath");
    if (pkg.downloadPath.startsWith("/") || pkg.downloadPath.includes("..")) {
      fail(`Catalog downloadPath must be relative and must not traverse: ${pkg.downloadPath}`);
    }
    checkString(pkg, "minimumGameVersion", { pattern: SEMVER_RE });
  }
  return true;
}

// ---------------------------------------------------------------- SVG safety

// Elements that may appear in artwork. Everything else is rejected.
const ALLOWED_ELEMENTS = new Set([
  "svg", "g", "path", "circle", "rect", "polygon", "ellipse", "line",
  "polyline", "text", "title", "desc", "defs",
]);

// Attributes that may appear. Anything else (notably on* handlers, href,
// xlink:href, style) is rejected.
const ALLOWED_ATTRIBUTES = new Set([
  "id", "class", "data-number",
  "d", "points", "cx", "cy", "r", "rx", "ry", "x", "y", "x1", "y1", "x2", "y2",
  "width", "height", "viewBox", "transform",
  "fill", "stroke", "stroke-width", "stroke-linejoin", "stroke-linecap",
  "opacity", "text-anchor", "dominant-baseline", "font-size", "font-family",
  "xmlns", "role", "aria-label",
]);

// Elements that are never allowed, even inside otherwise-valid SVG.
const FORBIDDEN_ELEMENTS = new Set([
  "script", "foreignObject", "iframe", "image", "audio", "video", "use",
  "animate", "animateTransform", "set", "style", "link", "meta", "a",
  "object", "embed", "form", "input",
]);

/**
 * Parse and sanitise SVG artwork. Throws ValidationError on any unsafe or
 * malformed content. Also checks the region mapping against the palette.
 *
 * @param {string} svgText - raw SVG text
 * @param {number[]} paletteNumbers - palette numbers from the canvas manifest
 * @returns {{ svg: string, regionCount: number, regionIds: string[] }}
 */
export function sanitizeSVG(svgText, paletteNumbers) {
  if (typeof svgText !== "string" || svgText.trim() === "") {
    fail("SVG artwork is empty");
  }
  if (/javascript:/i.test(svgText)) fail("SVG contains a javascript: reference");
  if (/<\s*script/i.test(svgText)) fail("SVG contains a script element");

  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, "image/svg+xml");
  const parserError = doc.querySelector("parsererror");
  if (parserError) fail(`SVG does not parse: ${parserError.textContent}`);

  const root = doc.documentElement;
  if (!root || root.tagName.toLowerCase() !== "svg") fail("SVG root element must be <svg>");
  if (!root.getAttribute("viewBox")) fail("SVG must declare a viewBox");

  const palette = new Set(paletteNumbers);
  const regionIds = new Set();
  const elements = [root, ...root.querySelectorAll("*")];

  for (const el of elements) {
    const tag = el.tagName.toLowerCase();
    if (FORBIDDEN_ELEMENTS.has(tag)) fail(`SVG contains forbidden element: <${tag}>`);
    if (!ALLOWED_ELEMENTS.has(tag)) fail(`SVG contains disallowed element: <${tag}>`);

    for (const attr of [...el.attributes]) {
      // Attribute names are case-sensitive in XML (viewBox, not viewbox), so
      // the allowlist compares the raw name; only the handler/link checks
      // use the lowercased form.
      const rawName = attr.name;
      const name = rawName.toLowerCase();
      if (name.startsWith("on")) fail(`SVG contains event handler attribute: ${name}`);
      if (name === "href" || name.endsWith(":href")) {
        fail("SVG contains a link/reference attribute");
      }
      if (!ALLOWED_ATTRIBUTES.has(rawName)) {
        fail(`SVG contains disallowed attribute: ${rawName}`);
      }
      if (/javascript:/i.test(attr.value)) {
        fail(`SVG attribute contains a javascript: reference: ${name}`);
      }
    }

    if (tag === "text") {
      const label = el.textContent.trim();
      if (!/^\d+$/.test(label)) fail(`Number label must be digits only, got: ${label}`);
    }
  }

  const regions = root.querySelectorAll("[data-number]");
  if (regions.length === 0) fail("SVG has no numbered regions");
  for (const region of regions) {
    const id = region.getAttribute("id");
    if (!id) fail("Every numbered region must have a stable id");
    if (regionIds.has(id)) fail(`Duplicate region id: ${id}`);
    regionIds.add(id);
    const number = Number(region.getAttribute("data-number"));
    if (!Number.isInteger(number) || !palette.has(number)) {
      fail(`Region ${id} has palette number ${number}, which is not in the palette`);
    }
  }

  const serializer = new XMLSerializer();
  return {
    svg: serializer.serializeToString(doc),
    regionCount: regionIds.size,
    regionIds: [...regionIds],
  };
}

/**
 * SHA-256 of a string, as lowercase hex. Uses Web Crypto; if it is unavailable
 * the caller must refuse the install (spec §1) — so this throws rather than
 * falling back to an insecure hash.
 */
export async function sha256Hex(text) {
  if (!window.crypto || !window.crypto.subtle) {
    throw new ValidationError("Web Crypto is unavailable — cannot verify checksums");
  }
  const data = new TextEncoder().encode(text);
  const digest = await window.crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
