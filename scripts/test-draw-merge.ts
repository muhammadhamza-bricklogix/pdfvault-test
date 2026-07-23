import { JSDOM } from "jsdom";

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  pretendToBeVisual: true,
  resources: "usable",
});

global.window = dom.window as unknown as Window & typeof globalThis;
global.document = dom.window.document;
global.navigator = dom.window.navigator;
global.HTMLElement = dom.window.HTMLElement;
global.HTMLCanvasElement = dom.window.HTMLCanvasElement;
global.Element = dom.window.Element;
global.Node = dom.window.Node;
global.Event = dom.window.Event;
global.MouseEvent = dom.window.MouseEvent;
global.Image = dom.window.Image;
global.HTMLImageElement = dom.window.HTMLImageElement;

const fabric = await import("fabric");
const { Canvas, Path } = fabric;
const el = document.createElement("canvas");
el.width = 612;
el.height = 792;
document.body.appendChild(el);
const fc = new Canvas(el, { backgroundColor: "transparent", width: 612, height: 792 });
const path = new Path("M 100 100 L 200 200", { stroke: "black", strokeWidth: 2, fill: null });
fc.add(path);
fc.renderAll();

const { serializeFabricCanvas } = await import("@/lib/client/pdf-editor/save-utils");
const { PDFDocument } = await import("pdf-lib");
const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

const json = serializeFabricCanvas(fc);
const fabricJsonByPage = new Map<number, string>([[1, json]]);

const pdfDoc = await PDFDocument.create();
pdfDoc.addPage([612, 792]);
const sourceBytesArr = await pdfDoc.save();
const sourceBytes = new Uint8Array(sourceBytesArr);
const sourceBuf = sourceBytes.buffer.slice(0);

const pdfDocument = await pdfjs.getDocument({ data: sourceBytes }).promise;

const { mergeFabricEditsIntoPdf } = await import("@/lib/client/pdf-editor/merge-pdf");
const mergedBytes = await mergeFabricEditsIntoPdf({
  fabricJsonByPage,
  fontDataMap: new Map(),
  pageOrder: [],
  pdfDocument,
  sourceBytes: sourceBuf,
});
console.log("source bytes", sourceBytesArr.byteLength, "merged bytes", mergedBytes.byteLength);

const mergedPdf = await PDFDocument.load(mergedBytes);
const mergedPage = mergedPdf.getPage(0);
const contentStream = mergedPage.getContentStream();
const raw = contentStream.getContents();
const text = new TextDecoder().decode(raw);
console.log("content stream snippet:", text.slice(0, 500));
console.log("has stroke operator 'S'?", /(^|\s)S(\s|$)/.test(text));
console.log("has line operator 'l'?", /(^|\s)l(\s|$)/.test(text));
console.log("has moveto 'm'?", /(^|\s)m(\s|$)/.test(text));
