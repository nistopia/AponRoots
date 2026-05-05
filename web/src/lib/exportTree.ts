"use client";

import { toPng } from "html-to-image";

const PADDING = 60;
// Cap the longer dimension of the PNG to avoid running out of memory on
// mobile browsers — even very large families top out at ~12000px wide,
// which still prints crisply at A0.
const MAX_PNG_DIM = 12000;
const MIN_PIXEL_RATIO = 2;
const MAX_PIXEL_RATIO = 4;

export type TreeExportFormat = "png" | "svg";

/**
 * Export the currently-rendered family tree as a high-resolution image.
 *
 * - `svg`: vector, infinite zoom — best for printing at large sizes.
 * - `png`: raster, capped at MAX_PNG_DIM px — best for sharing.
 *
 * The export captures the FULL tree (not just the visible viewport), with
 * R2 photos inlined as data URLs so the file is self-contained.
 */
export async function exportTree(
  format: TreeExportFormat,
  filename = "family-tree",
): Promise<void> {
  const container = document.getElementById("tree-container");
  const liveSvg = container?.querySelector("svg") as SVGSVGElement | null;
  if (!liveSvg) {
    throw new Error("Tree SVG not found — render the tree first.");
  }
  const liveInnerG = liveSvg.querySelector("g") as SVGGElement | null;
  if (!liveInnerG) {
    throw new Error("Tree group not found.");
  }

  // getBBox on the live group returns the bounding box of all rendered
  // content in the group's local coordinate system, ignoring its own
  // transform. This is what we want — the FULL tree, not the viewport.
  const bbox = liveInnerG.getBBox();
  const w = Math.ceil(bbox.width + PADDING * 2);
  const h = Math.ceil(bbox.height + PADDING * 2);
  const vbX = Math.floor(bbox.x - PADDING);
  const vbY = Math.floor(bbox.y - PADDING);

  // Build a clone sized to the full tree with the d3 zoom/pan transform
  // neutralized.
  const svg = liveSvg.cloneNode(true) as SVGSVGElement;
  const innerG = svg.querySelector("g") as SVGGElement;
  innerG.removeAttribute("transform");
  svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  svg.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
  svg.setAttribute("viewBox", `${vbX} ${vbY} ${w} ${h}`);
  svg.setAttribute("width", String(w));
  svg.setAttribute("height", String(h));

  // White background rect so the export isn't transparent.
  const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  bg.setAttribute("x", String(vbX));
  bg.setAttribute("y", String(vbY));
  bg.setAttribute("width", String(w));
  bg.setAttribute("height", String(h));
  bg.setAttribute("fill", "#ffffff");
  svg.insertBefore(bg, svg.firstChild);

  // Inline R2 photos as data URLs (self-contained file + no canvas taint).
  await inlineImages(svg);

  if (format === "svg") {
    downloadSvg(svg, `${filename}.svg`);
    return;
  }

  await downloadPng(svg, w, h, `${filename}.png`);
}

async function inlineImages(svg: SVGSVGElement): Promise<void> {
  const imgs = Array.from(svg.querySelectorAll("img"));
  await Promise.all(
    imgs.map(async (img) => {
      const src = img.getAttribute("src");
      if (!src || src.startsWith("data:")) return;
      try {
        const res = await fetch(src, { mode: "cors", cache: "force-cache" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        const dataUrl = await blobToDataUrl(blob);
        img.setAttribute("src", dataUrl);
      } catch {
        // CORS or network failure — strip the broken photo so the canvas
        // isn't tainted. The person's name is still in the export via the
        // second foreignObject in personGlyph.
        img.removeAttribute("src");
        const parent = img.parentElement;
        if (parent) parent.removeChild(img);
      }
    }),
  );
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(blob);
  });
}

async function downloadPng(
  svg: SVGSVGElement,
  w: number,
  h: number,
  filename: string,
): Promise<void> {
  // Mount off-screen so html-to-image can read computed styles.
  const host = document.createElement("div");
  host.style.position = "fixed";
  host.style.left = "-99999px";
  host.style.top = "0";
  host.style.width = `${w}px`;
  host.style.height = `${h}px`;
  host.appendChild(svg);
  document.body.appendChild(host);

  try {
    const longest = Math.max(w, h);
    const pixelRatio = Math.min(
      MAX_PIXEL_RATIO,
      Math.max(MIN_PIXEL_RATIO, MAX_PNG_DIM / longest),
    );
    const dataUrl = await toPng(svg as unknown as HTMLElement, {
      pixelRatio,
      backgroundColor: "#ffffff",
      cacheBust: false,
      width: w,
      height: h,
    });
    triggerDownload(dataUrl, filename);
  } finally {
    document.body.removeChild(host);
  }
}

function downloadSvg(svg: SVGSVGElement, filename: string): void {
  const xml = new XMLSerializer().serializeToString(svg);
  const blob = new Blob(
    ['<?xml version="1.0" encoding="UTF-8"?>\n', xml],
    { type: "image/svg+xml;charset=utf-8" },
  );
  const url = URL.createObjectURL(blob);
  triggerDownload(url, filename);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function triggerDownload(href: string, filename: string): void {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
