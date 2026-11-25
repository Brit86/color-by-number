/**
 * app.js — Color by Number shell: bootstrap, navigation, service worker
 * registration, local-first rendering (spec §3: local content first, remote
 * catalog check afterwards — the remote check lands in Phase 5).
 *
 * Phase 1: Home shows the real starter gallery. My Art and Parent Settings
 * render honest "coming in a later phase" states — no fake controls.
 */

import { openDB, getStoreNames } from "./db.js";
import { getStarterCanvases, loadCanvas } from "./content.js";

const VIEWS = ["home", "myart", "parents"];
let currentView = "home";

function $(selector) {
  return document.querySelector(selector);
}

function showStatus(message, isError = false) {
  const status = $("#status");
  if (!status) return;
  status.textContent = message;
  status.classList.toggle("error", isError);
}

/** Offline badge: quiet, never blocking (spec §3). */
function updateOnlineBadge() {
  const badge = $("#offline-badge");
  if (!badge) return;
  badge.hidden = navigator.onLine;
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    console.warn("Service workers are not supported in this browser");
    return null;
  }
  try {
    const registration = await navigator.serviceWorker.register("sw.js");
    console.log("Service worker registered:", registration.scope);
    return registration;
  } catch (error) {
    console.warn("Service worker registration failed:", error);
    return null;
  }
}

function canvasCard(canvas) {
  const card = document.createElement("article");
  card.className = "canvas-card";
  card.tabIndex = 0;
  card.setAttribute("role", "button");
  card.setAttribute("aria-label", `${canvas.title}, ${canvas.category}. Open details.`);
  card.innerHTML = `
    <img class="canvas-thumb" src="${canvas.thumbnail}" alt="Preview of ${canvas.title}" loading="lazy">
    <div class="canvas-info">
      <h3>${escapeHtml(canvas.title)}</h3>
      <p class="canvas-meta">${escapeHtml(canvas.category)}</p>
    </div>`;
  const open = () => openCanvasDialog(canvas.id);
  card.addEventListener("click", open);
  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      open();
    }
  });
  return card;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function renderGallery() {
  const gallery = $("#gallery");
  gallery.innerHTML = "";
  showStatus("Loading your pictures…");
  try {
    const canvases = await getStarterCanvases();
    if (canvases.length === 0) {
      showStatus("No pictures found in the starter library.", true);
      return;
    }
    for (const canvas of canvases) {
      gallery.appendChild(canvasCard(canvas));
    }
    showStatus(`${canvases.length} starter pictures ready — tap one to see its details.`);
  } catch (error) {
    console.error("Gallery failed to load:", error);
    showStatus("Could not load the starter pictures. Try reloading.", true);
  }
}

/** Canvas detail sheet: real manifest data, honest Phase 2 note, no fake play. */
async function openCanvasDialog(canvasId) {
  const dialog = $("#canvas-dialog");
  const body = $("#canvas-dialog-body");
  body.innerHTML = "<p>Loading details…</p>";
  dialog.showModal();
  try {
    const { manifest, regionCount } = await loadCanvas(canvasId);
    const palette = manifest.palette
      .map(
        (entry) => `
          <li class="palette-chip">
            <span class="swatch" style="background:${entry.color}"></span>
            <span class="palette-number">${entry.number}</span>
            <span class="palette-name">${escapeHtml(entry.name || entry.color)}</span>
          </li>`,
      )
      .join("");
    body.innerHTML = `
      <img class="dialog-thumb" src="content/starter/${manifest.id}/thumbnail.svg"
           alt="Finished preview of ${escapeHtml(manifest.title)}">
      <h2>${escapeHtml(manifest.title)}</h2>
      <p>${escapeHtml(manifest.description || "")}</p>
      <dl class="detail-list">
        <div><dt>Category</dt><dd>${escapeHtml(manifest.category)}</dd></div>
        <div><dt>Difficulty</dt><dd>${escapeHtml(manifest.difficulty)}</dd></div>
        <div><dt>Regions to colour</dt><dd>${regionCount}</dd></div>
        <div><dt>Colours</dt><dd>${manifest.palette.length}</dd></div>
      </dl>
      <h3>Palette</h3>
      <ul class="palette-list">${palette}</ul>
      <p class="phase-note">Colouring this picture arrives in Phase 2 — the colouring
      engine. For now you can look at the finished preview above.</p>
      <button class="button" disabled>Colour this picture — coming in Phase 2</button>`;
  } catch (error) {
    console.error("Canvas details failed:", error);
    body.innerHTML = "<p>Sorry — this picture could not be checked and opened. It has not been shown.</p>";
  }
}

function showView(view) {
  currentView = view;
  for (const name of VIEWS) {
    const section = $(`#view-${name}`);
    if (section) section.hidden = name !== view;
    const tab = $(`#tab-${name}`);
    if (tab) {
      tab.setAttribute("aria-current", name === view ? "page" : "false");
      tab.classList.toggle("active", name === view);
    }
  }
  const titles = { home: "Home", myart: "My Art", parents: "Parent Settings" };
  $("#view-title").textContent = titles[view];
}

function initNavigation() {
  for (const name of VIEWS) {
    $(`#tab-${name}`).addEventListener("click", () => showView(name));
  }
  $("#dialog-close").addEventListener("click", () => $("#canvas-dialog").close());
  $("#canvas-dialog").addEventListener("click", (event) => {
    if (event.target === event.currentTarget) event.currentTarget.close();
  });
}

async function bootstrap() {
  updateOnlineBadge();
  window.addEventListener("online", updateOnlineBadge);
  window.addEventListener("offline", updateOnlineBadge);
  initNavigation();
  showView("home");
  await registerServiceWorker();
  try {
    await openDB();
    const stores = await getStoreNames();
    console.log("IndexedDB open, stores:", stores.join(", "));
  } catch (error) {
    console.error("IndexedDB failed to open:", error);
    showStatus("Saved pictures and progress are unavailable in this browser.", true);
  }
  await renderGallery();
}

document.addEventListener("DOMContentLoaded", bootstrap);
