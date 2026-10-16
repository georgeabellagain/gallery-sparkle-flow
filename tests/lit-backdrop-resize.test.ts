import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { createLitBackdrop } from "../src/lib/portfolia/lit-backdrop";

test("Studio backdrop reallocates uploaded textures after fullscreen resize", async () => {
  const originalDocument = globalThis.document, originalImage = globalThis.Image;
  let patterns=0, fills=0;
  const context = {
    drawImage() {}, clearRect() {}, putImageData() {},
    createPattern(){patterns++;return {};}, save(){}, restore(){}, translate(){}, fillRect(){fills++;},
    getImageData(_x: number, _y: number, w: number, h: number) { return { data: new Uint8ClampedArray(w * h * 4) }; },
  };
  globalThis.document = { createElement() { return { width: 300, height: 150, getContext() { return context; } }; } } as unknown as Document;
  globalThis.Image = class { naturalWidth = 1600; naturalHeight = 900; decode() { return Promise.resolve(); } } as unknown as typeof Image;
  let backdrop: ReturnType<typeof createLitBackdrop> | undefined;
  try {
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(45, 800 / 640);
    camera.position.z = 4;
    backdrop = createLitBackdrop(scene, () => {});
    backdrop.set("example.jpg", undefined, true, "#191d3a", true, true);
    await backdrop.ready();
    backdrop.frame(camera, 800, 640);
    const material = (scene.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial;
    const oldMap = material.map!, oldNormals = material.normalMap!;
    assert.equal(oldMap.image.width, 1600); // preserve source detail in the small viewer
    let mapDisposed = false, normalsDisposed = false;
    oldMap.addEventListener("dispose", () => { mapDisposed = true; });
    oldNormals.addEventListener("dispose", () => { normalsDisposed = true; });
    camera.aspect = 1920 / 1080;
    backdrop.frame(camera, 1920, 1080);
    assert.notEqual(material.map, oldMap);
    assert.notEqual(material.normalMap, oldNormals);
    assert.equal(mapDisposed, true);
    assert.equal(normalsDisposed, true);
    assert.equal(material.map!.image.width, 1920);
    assert.equal(material.map!.image.height, 1080);
    const fullMap = material.map;
    backdrop.frame(camera, 1920, 1080);
    assert.equal(material.map, fullMap);
    camera.aspect = 800 / 640;
    backdrop.frame(camera, 800, 640);
    assert.notEqual(material.map, fullMap);
    assert.equal(material.map!.image.width, 1600);
    const previousFills = fills;
    backdrop.set("example.jpg",{scale:.25,tile:true},true,"#191d3a",true,true);
    backdrop.frame(camera,800,640);
    assert.equal(patterns,1);assert.equal(fills - previousFills,2,"a reduced preset repeats to fill the entire frame");
    backdrop.set("example.jpg",{scale:.25},true,"#191d3a",true,true);
    backdrop.frame(camera,800,640);
    assert.equal(patterns,1,"uploaded photographs keep their covering minimum scale");
  } finally {
    backdrop?.dispose();
    globalThis.document = originalDocument;
    globalThis.Image = originalImage;
  }
});

test("3D surfaces load real maps once and reuse them during camera movement", async () => {
  const originalDocument = globalThis.document, originalImage = globalThis.Image;
  const loaded: string[] = [];
  const context = { drawImage() {}, clearRect() {}, fillRect() {} };
  globalThis.document = { createElement() { return { width: 300, height: 150, getContext() { return context; } }; } } as unknown as Document;
  globalThis.Image = class { src = ""; naturalWidth = 1024; naturalHeight = 1024; decode() { loaded.push(this.src); return Promise.resolve(); } } as unknown as typeof Image;
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(45, 1);
  camera.position.z = 4;
  const backdrop = createLitBackdrop(scene, () => {});
  const url = "/studio/backgrounds/wood_floor.webp";
  try {
    backdrop.set(url, undefined, true);
    await backdrop.ready();
    backdrop.frame(camera, 600, 600);
    const material = (scene.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial;
    assert.equal(material.normalMap, null);
    assert.equal(loaded.length, 1, "flat backgrounds do not fetch surface maps");
    backdrop.set(url, undefined, true, "#fff", true, true);
    await backdrop.ready();
    backdrop.frame(camera, 600, 600);
    assert.deepEqual(loaded, [url, "/studio/backgrounds/wood_floor-nor_gl.webp", "/studio/backgrounds/wood_floor-rough.webp"]);
    const normal = material.normalMap, rough = material.roughnessMap;
    assert.ok(normal); assert.ok(rough);
    assert.equal(normal.colorSpace, THREE.NoColorSpace);
    assert.equal(rough.colorSpace, THREE.NoColorSpace);
    camera.position.x = 1; camera.position.z = 2;
    backdrop.frame(camera, 600, 600);
    assert.equal(material.normalMap, normal); assert.equal(material.roughnessMap, rough);
    backdrop.set(url, undefined, true, "#fff", true, false);
    await backdrop.ready();
    assert.equal(material.normalMap, null); assert.equal(material.roughnessMap, null);
    backdrop.set(url, undefined, true, "#fff", true, true);
    await backdrop.ready();
    assert.equal(loaded.length, 3, "toggling reuses decoded maps");
  } finally {
    backdrop.dispose(); globalThis.document = originalDocument; globalThis.Image = originalImage;
  }
});
