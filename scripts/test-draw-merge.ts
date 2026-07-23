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
console.log("fabric loaded", Object.keys(fabric).slice(0,10));
const { Canvas, Path } = fabric;
const el = document.createElement("canvas");
el.width = 612;
el.height = 792;
document.body.appendChild(el);
const fc = new Canvas(el, { backgroundColor: "transparent", width: 612, height: 792 });
const path = new Path("M 100 100 L 200 200", { stroke: "black", strokeWidth: 2, fill: null });
fc.add(path);
fc.renderAll();
console.log("objects", fc.getObjects().length);
