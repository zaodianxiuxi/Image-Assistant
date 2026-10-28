import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";
import type { WorkspaceView } from "./types";

type Triple = [number, number, number];
export const stations: {
  id: WorkspaceView;
  label: string;
  position: Triple;
}[] = [
  { id: "files", label: "文件托盘", position: [-3.65, 0, 1.5] },
  { id: "reader", label: "阅读台", position: [-3.3, 0, -1.65] },
  { id: "create", label: "图片创作", position: [0, 0, -1.1] },
  { id: "tools", label: "转换工具", position: [3.45, 0, -1.6] },
  { id: "tasks", label: "任务中心", position: [3.25, 0, 1.75] },
];

/** A self-contained product photography set; every generated GPU asset has one owner. */
export function createStudio(
  renderer: THREE.WebGLRenderer,
  dark: boolean,
  warm: boolean,
) {
  const scene = new THREE.Scene();
  const background = dark ? 0x24282d : warm ? 0xdad6cf : 0xdde0e3;
  scene.background = new THREE.Color(background);
  const materials: THREE.Material[] = [];
  const textures: THREE.Texture[] = [];
  const extraGeometry: THREE.BufferGeometry[] = [];
  let seed = 251028;
  const random = () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  function canvasTexture(
    width: number,
    height: number,
    paint: (ctx: CanvasRenderingContext2D) => void,
    color = true,
  ) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    paint(canvas.getContext("2d")!);
    const texture = new THREE.CanvasTexture(canvas);
    if (color) texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
    textures.push(texture);
    return texture;
  }
  // Deterministic microstructure: no photographs or external assets are requested.
  const grain = canvasTexture(
    512,
    512,
    (ctx) => {
      const pixels = ctx.createImageData(512, 512);
      for (let i = 0; i < pixels.data.length; i += 4) {
        const v = 115 + Math.floor(random() * 34);
        pixels.data.set([v, v, v, 255], i);
      }
      ctx.putImageData(pixels, 0, 0);
    },
    false,
  );
  grain.wrapS = grain.wrapT = THREE.RepeatWrapping;
  grain.repeat.set(5, 5);
  const brushed = canvasTexture(
    512,
    512,
    (ctx) => {
      ctx.fillStyle = "#808080";
      ctx.fillRect(0, 0, 512, 512);
      for (let y = 0; y < 512; y++) {
        const v = 107 + Math.floor(random() * 42);
        ctx.fillStyle = `rgb(${v},${v},${v})`;
        ctx.fillRect(0, y, 512, 1);
      }
    },
    false,
  );
  brushed.wrapS = brushed.wrapT = THREE.RepeatWrapping;
  brushed.repeat.set(2, 8);
  function physical(parameters: THREE.MeshPhysicalMaterialParameters) {
    const result = new THREE.MeshPhysicalMaterial(parameters);
    materials.push(result);
    return result;
  }
  const aluminium = physical({
    color: 0xbcc2c8,
    metalness: 1,
    roughness: 0.31,
    bumpMap: brushed,
    bumpScale: 0.002,
    anisotropy: 0.55,
  });
  const polished = physical({ color: 0xd0d5db, metalness: 1, roughness: 0.17 });
  const graphite = physical({
    color: 0x282d33,
    metalness: 0.72,
    roughness: 0.34,
    bumpMap: grain,
    bumpScale: 0.002,
  });
  const polymer = physical({
    color: 0xdddeda,
    roughness: 0.34,
    clearcoat: 0.32,
    clearcoatRoughness: 0.3,
    bumpMap: grain,
    bumpScale: 0.0015,
  });
  const rubber = physical({
    color: 0x15181c,
    roughness: 0.89,
    bumpMap: grain,
    bumpScale: 0.003,
  });
  const paper = physical({
    color: 0xf2efe8,
    roughness: 0.86,
    sheen: 0.25,
    sheenColor: new THREE.Color(0xffffff),
    bumpMap: grain,
    bumpScale: 0.001,
  });
  const fabric = physical({
    color: warm ? 0x6e6255 : 0x576269,
    roughness: 0.9,
    sheen: 0.4,
    bumpMap: grain,
    bumpScale: 0.008,
  });
  const glass = physical({
    color: 0xdce5e6,
    transmission: 0.91,
    thickness: 0.12,
    ior: 1.48,
    roughness: 0.24,
    metalness: 0,
    attenuationColor: new THREE.Color(0xb0c4c6),
    attenuationDistance: 2.5,
    envMapIntensity: 0.8,
  });
  // Thin opal polymer uses transmission/volume attenuation, not an opaque painted highlight.
  const opal = physical({
    color: 0xf4f4ef,
    transmission: 0.35,
    thickness: 0.18,
    ior: 1.46,
    roughness: 0.42,
    attenuationColor: new THREE.Color(0xc8d5cf),
    attenuationDistance: 0.6,
  });
  const smokedGlass = physical({
    color: 0x18232b,
    metalness: 0.05,
    roughness: 0.15,
    clearcoat: 1,
    clearcoatRoughness: 0.12,
  });
  const led = physical({
    color: 0xbbd5cc,
    emissive: 0x9bbcb0,
    emissiveIntensity: 0.4,
    roughness: 0.3,
  });
  function mesh(
    parent: THREE.Object3D,
    geometry: THREE.BufferGeometry,
    mat: THREE.Material,
    position: Triple,
  ) {
    const result = new THREE.Mesh(geometry, mat);
    result.position.set(...position);
    result.castShadow = true;
    result.receiveShadow = true;
    parent.add(result);
    return result;
  }
  function box(
    parent: THREE.Object3D,
    size: Triple,
    position: Triple,
    mat: THREE.Material,
    radius = 0.025,
  ) {
    return mesh(
      parent,
      new RoundedBoxGeometry(
        ...size,
        4,
        Math.min(radius, Math.min(...size) * 0.49),
      ),
      mat,
      position,
    );
  }
  function cylinder(
    parent: THREE.Object3D,
    radius: number,
    height: number,
    position: Triple,
    mat: THREE.Material,
  ) {
    return mesh(
      parent,
      new THREE.CylinderGeometry(radius, radius, height, 48),
      mat,
      position,
    );
  }
  const contactTexture = canvasTexture(128, 128, (ctx) => {
    const gradient = ctx.createRadialGradient(64, 64, 5, 64, 64, 63);
    gradient.addColorStop(0, "rgba(0,0,0,.48)");
    gradient.addColorStop(0.5, "rgba(0,0,0,.22)");
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
  });
  function contact(
    parent: THREE.Object3D,
    width: number,
    depth: number,
    y = 0.006,
    opacity = 0.5,
  ) {
    const mat = new THREE.MeshBasicMaterial({
      map: contactTexture,
      transparent: true,
      opacity,
      depthWrite: false,
      toneMapped: false,
    });
    materials.push(mat);
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), mat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = y;
    shadow.raycast = () => {};
    parent.add(shadow);
  }
  function printedPage(title: string, index: string) {
    return canvasTexture(768, 1024, (ctx) => {
      ctx.fillStyle = "#f2efe7";
      ctx.fillRect(0, 0, 768, 1024);
      ctx.fillStyle = "#656b6d";
      ctx.font = "21px Arial";
      ctx.fillText("WORKSPACE  /  " + index, 70, 85);
      ctx.fillStyle = "#283039";
      ctx.font = "48px Georgia";
      ctx.fillText(title, 70, 170);
      ctx.fillStyle = "#adb2b0";
      ctx.fillRect(70, 220, 620, 2);
      for (let i = 0; i < 24; i++) {
        ctx.fillStyle = i % 7 === 0 ? "#6f777a" : "#a1a6a5";
        ctx.fillRect(
          70,
          270 + i * 24,
          i % 6 === 5 ? 340 : 570 + random() * 45,
          4,
        );
      }
      ctx.fillStyle = "#b2b5ae";
      ctx.fillRect(70, 900, 80, 3);
      ctx.fillStyle = "#717b7d";
      ctx.font = "20px Arial";
      ctx.fillText(index, 650, 945);
    });
  }
  function topPage(
    parent: THREE.Object3D,
    size: [number, number],
    pos: Triple,
    texture: THREE.Texture,
  ) {
    const mat = physical({
      map: texture,
      roughness: 0.86,
      bumpMap: grain,
      bumpScale: 0.001,
    });
    const page = mesh(parent, new THREE.PlaneGeometry(...size), mat, pos);
    page.rotation.x = -Math.PI / 2;
    return page;
  }
  function screw(parent: THREE.Object3D, x: number, y: number, z: number) {
    cylinder(parent, 0.028, 0.009, [x, y, z], polished);
    box(parent, [0.034, 0.004, 0.005], [x, y + 0.006, z], graphite, 0.001);
  }
  function engraving(
    parent: THREE.Object3D,
    text: string,
    pos: Triple,
    width = 0.65,
  ) {
    const texture = canvasTexture(256, 64, (ctx) => {
      ctx.fillStyle = "#626b72";
      ctx.font = "500 24px Arial";
      ctx.textAlign = "center";
      ctx.fillText(text, 128, 41);
    });
    const mat = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    materials.push(mat);
    const label = mesh(
      parent,
      new THREE.PlaneGeometry(width, width / 4),
      mat,
      pos,
    );
    label.rotation.x = -Math.PI / 2;
    label.castShadow = false;
  }

  // The same upper-left softbox drives the environment reflection and the key shadow.
  const environment = new THREE.Scene();
  environment.background = new THREE.Color(0x8a919b);
  const softboxGeometry = new THREE.PlaneGeometry(1, 1);
  extraGeometry.push(softboxGeometry);
  function softbox(
    position: Triple,
    width: number,
    height: number,
    intensity: number,
  ) {
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(intensity, intensity * 0.985, intensity * 0.965),
      side: THREE.DoubleSide,
    });
    materials.push(mat);
    const light = new THREE.Mesh(softboxGeometry, mat);
    light.position.set(...position);
    light.scale.set(width, height, 1);
    light.lookAt(0, 0, 0);
    environment.add(light);
  }
  softbox([-5, 9, 5], 8, 6, 7);
  softbox([7, 4, -5], 2, 7, 1.5);
  softbox([0, 5, -8], 8, 1, 0.8);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const reflection = pmrem.fromScene(environment, 0.06, 0.1, 60);
  pmrem.dispose();
  scene.environment = reflection.texture;
  scene.environmentIntensity = 0.78;
  RectAreaLightUniformsLib.init();
  const keyArea = new THREE.RectAreaLight(0xfff8ef, 4, 8, 6);
  keyArea.position.set(-5, 9, 5);
  keyArea.lookAt(0, 0, 0);
  scene.add(keyArea);
  const key = new THREE.DirectionalLight(0xfffaf4, 2.1);
  key.position.set(-5, 9, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, {
    left: -10,
    right: 10,
    top: 10,
    bottom: -10,
    near: 0.5,
    far: 35,
  });
  key.shadow.bias = -0.00015;
  key.shadow.normalBias = 0.018;
  key.shadow.radius = 12;
  scene.add(key);
  scene.add(new THREE.HemisphereLight(0xe5edf5, 0x63666a, 0.45));

  const floorMaterial = physical({
    color: background,
    roughness: 0.92,
    bumpMap: grain,
    bumpScale: 0.004,
  });
  const floor = mesh(
    scene,
    new THREE.PlaneGeometry(200, 200),
    floorMaterial,
    [0, -0.32, 0],
  );
  floor.rotation.x = -Math.PI / 2;
  floor.castShadow = false;
  const deskMaterial = physical({
    color: dark ? 0x383d44 : warm ? 0xb9b4ab : 0xadb3b8,
    roughness: 0.65,
    metalness: 0.12,
    bumpMap: grain,
    bumpScale: 0.003,
  });
  const desk = new THREE.Group();
  scene.add(desk);
  contact(desk, 16, 11, -0.309, 0.55);
  box(desk, [12.3, 0.15, 7.85], [0, -0.17, 0], graphite, 0.07);
  box(desk, [12.25, 0.08, 7.8], [0, -0.058, 0], deskMaterial, 0.035);
  engraving(
    desk,
    "IMAGE ASSISTANT   /   WORKSPACE 01",
    [-3.7, -0.014, 3.55],
    2.9,
  );

  const groups: THREE.Group[] = [];
  for (const station of stations) {
    const group = new THREE.Group();
    group.position.set(...station.position);
    group.userData.tool = station.id;
    scene.add(group);
    groups.push(group);
    if (station.id === "files") {
      contact(group, 3.8, 3.1);
      for (const x of [-1.07, 1.07])
        for (const z of [-0.85, 0.85])
          cylinder(group, 0.075, 0.07, [x, 0.035, z], rubber);
      box(group, [2.65, 0.055, 2.05], [0, 0.105, 0], aluminium);
      box(group, [0.045, 0.25, 2.05], [-1.3, 0.23, 0], aluminium);
      box(group, [0.045, 0.25, 2.05], [1.3, 0.23, 0], aluminium);
      box(group, [2.65, 0.25, 0.045], [0, 0.23, -1], aluminium);
      for (let i = 0; i < 12; i++) {
        const page = box(
          group,
          [2.23, 0.008, 1.68],
          [0.012 * Math.sin(i), 0.143 + i * 0.011, 0.025 * Math.cos(i)],
          paper,
          0.003,
        );
        page.rotation.y = 0.014 * Math.sin(i);
      }
      const page = topPage(
        group,
        [2.23, 1.68],
        [0, 0.278, 0.02],
        printedPage("Working notes", "01"),
      );
      page.rotation.z = -0.02;
      engraving(group, "INBOX", [0, 0.134, 0.92]);
      // A steel paperclip, made as a continuous bent wire.
      const clipCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.12, 0, -0.23),
        new THREE.Vector3(-0.12, 0, 0.2),
        new THREE.Vector3(0.1, 0, 0.2),
        new THREE.Vector3(0.1, 0, -0.23),
        new THREE.Vector3(-0.06, 0, -0.23),
        new THREE.Vector3(-0.06, 0, 0.12),
      ]);
      mesh(
        group,
        new THREE.TubeGeometry(clipCurve, 40, 0.012, 8, false),
        polished,
        [0.75, 0.3, -0.5],
      );
    } else if (station.id === "reader") {
      contact(group, 3.9, 2.9);
      box(group, [2.9, 0.07, 2.05], [0, 0.07, 0], fabric);
      box(group, [1.37, 0.15, 1.91], [-0.72, 0.18, 0], paper, 0.025);
      box(group, [1.37, 0.15, 1.91], [0.72, 0.18, 0], paper, 0.025);
      // Real curved page surfaces catch a continuous highlight around the binding.
      for (const side of [-1, 1]) {
        const geometry = new THREE.PlaneGeometry(1.39, 1.91, 40, 1);
        const positions = geometry.attributes.position;
        for (let i = 0; i < positions.count; i++) {
          const u = (positions.getX(i) + 0.695) / 1.39;
          if (side === -1) geometry.attributes.uv.setX(i, 1 - u);
          positions.setXYZ(
            i,
            side * (0.025 + u * 1.39),
            0.255 + 0.11 * Math.sin(u * Math.PI) - 0.055 * Math.exp(-u * 12),
            -positions.getY(i),
          );
        }
        geometry.computeVertexNormals();
        const mat = physical({
          map: printedPage(
            side === -1 ? "A quiet focus." : "Make room.",
            side === -1 ? "02" : "03",
          ),
          roughness: 0.88,
          side: THREE.DoubleSide,
          bumpMap: grain,
          bumpScale: 0.001,
        });
        mesh(group, geometry, mat, [0, 0, 0]);
        for (let i = 0; i < 7; i++)
          box(
            group,
            [1.3, 0.003, 0.007],
            [side * 0.73, 0.115 + i * 0.019, 0.956],
            fabric,
            0.001,
          );
      }
      box(group, [0.065, 0.008, 0.5], [0.06, 0.055, 1.13], graphite, 0.002);
      // Slim aluminium pencil, resting beside the book.
      const pencil = cylinder(group, 0.034, 1.8, [1.58, 0.08, 0.1], aluminium);
      pencil.rotation.x = Math.PI / 2;
      pencil.rotation.z = -0.1;
    } else if (station.id === "create") {
      contact(group, 4.3, 3.3, 0.008, 0.6);
      box(group, [2.1, 0.07, 1.45], [0, 0.07, 0.48], aluminium, 0.06);
      box(group, [1.96, 0.018, 1.3], [0, 0.027, 0.48], rubber);
      const stand = box(group, [0.42, 1.28, 0.1], [0, 0.7, -0.05], aluminium);
      stand.rotation.x = -0.15;
      const display = new THREE.Group();
      display.position.set(0, 1.78, -0.11);
      display.rotation.x = -0.075;
      group.add(display);
      box(display, [3.2, 2.06, 0.13], [0, 0, 0], aluminium, 0.065);
      box(display, [3.12, 1.98, 0.055], [0, 0, 0.074], graphite, 0.055);
      const screenTexture = canvasTexture(1400, 880, (ctx) => {
        const bg = ctx.createLinearGradient(0, 0, 1400, 880);
        bg.addColorStop(0, "#17252d");
        bg.addColorStop(1, "#06090c");
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, 1400, 880);
        // Sculptural metallic ribbons instead of a flat illustrative mountain icon.
        ctx.save();
        ctx.translate(850, 400);
        ctx.rotate(-0.4);
        for (let i = 0; i < 6; i++) {
          const x = -260 + i * 80;
          const g = ctx.createLinearGradient(x, 0, x + 125, 0);
          g.addColorStop(0, "#253139");
          g.addColorStop(0.3, "#c0cbc9");
          g.addColorStop(0.43, "#f4f1e6");
          g.addColorStop(0.53, "#8caaa9");
          g.addColorStop(1, "#14252e");
          ctx.strokeStyle = g;
          ctx.lineWidth = 70;
          ctx.beginPath();
          ctx.moveTo(x, -250);
          ctx.bezierCurveTo(x + 180, -60, x - 120, 90, x + 50, 280);
          ctx.stroke();
        }
        ctx.restore();
        ctx.fillStyle = "#e5ebe9";
        ctx.font = "24px Arial";
        ctx.fillText("IMAGE ASSISTANT", 70, 75);
        ctx.font = "72px Georgia";
        ctx.fillText("A space", 70, 365);
        ctx.fillText("to create.", 70, 450);
        ctx.fillStyle = "#9cacae";
        ctx.font = "18px Arial";
        ctx.fillText("STUDIO   /   01", 70, 790);
      });
      const screen = physical({
        map: screenTexture,
        emissiveMap: screenTexture,
        emissive: 0xffffff,
        emissiveIntensity: 0.26,
        roughness: 0.19,
        metalness: 0.05,
        clearcoat: 1,
        clearcoatRoughness: 0.12,
      });
      box(display, [2.99, 1.84, 0.012], [0, 0.015, 0.107], screen, 0.018);
      const camera = mesh(
        display,
        new THREE.SphereGeometry(0.016, 12, 8),
        smokedGlass,
        [0, 0.963, 0.11],
      );
      camera.castShadow = false;
      box(display, [0.08, 0.009, 0.009], [1.35, -0.957, 0.106], led, 0.004);
      // Small aluminium keyboard, individual keycaps and engraved baseline.
      box(group, [2.35, 0.065, 0.82], [0, 0.07, 1.9], aluminium, 0.045);
      for (let row = 0; row < 4; row++)
        for (let col = 0; col < 13; col++)
          if (row < 3 || col < 4 || col > 8)
            box(
              group,
              [0.145, 0.035, 0.135],
              [-1.04 + col * 0.173, 0.116, 1.65 + row * 0.17],
              polymer,
              0.016,
            );
      box(group, [0.76, 0.036, 0.12], [0, 0.119, 2.16], polymer, 0.014);
    } else if (station.id === "tools") {
      contact(group, 3.4, 2.8);
      for (const x of [-0.95, 0.95])
        for (const z of [-0.65, 0.65])
          cylinder(group, 0.075, 0.07, [x, 0.035, z], rubber);
      box(group, [2.5, 0.62, 1.83], [0, 0.39, 0], aluminium, 0.09);
      box(group, [2.46, 0.015, 1.78], [0, 0.56, 0], graphite, 0.04);
      box(group, [2.49, 0.13, 1.82], [0, 0.67, 0], aluminium, 0.065);
      box(
        group,
        [1.13, 0.025, 0.75],
        [-0.45, 0.749, -0.15],
        smokedGlass,
        0.045,
      );
      const panelTexture = canvasTexture(512, 256, (ctx) => {
        ctx.fillStyle = "#111d24";
        ctx.fillRect(0, 0, 512, 256);
        ctx.fillStyle = "#afc9c2";
        ctx.font = "28px monospace";
        ctx.fillText("FILEE", 35, 57);
        ctx.font = "52px monospace";
        ctx.fillText("READY", 35, 140);
        ctx.fillStyle = "#657c7e";
        ctx.font = "18px monospace";
        ctx.fillText("LOCAL ENGINE / 01", 35, 208);
      });
      topPage(group, [1.01, 0.61], [-0.45, 0.765, -0.15], panelTexture);
      cylinder(group, 0.31, 0.06, [0.79, 0.76, -0.15], graphite);
      cylinder(group, 0.275, 0.19, [0.79, 0.86, -0.15], aluminium);
      cylinder(group, 0.24, 0.008, [0.79, 0.96, -0.15], polished);
      for (let i = 0; i < 40; i++) {
        const angle = (i * Math.PI) / 20;
        const ridge = box(
          group,
          [0.014, 0.13, 0.015],
          [
            0.79 + Math.cos(angle) * 0.276,
            0.86,
            -0.15 + Math.sin(angle) * 0.276,
          ],
          graphite,
          0.004,
        );
        ridge.rotation.y = -angle;
      }
      box(group, [0.018, 0.006, 0.11], [0.79, 0.969, -0.3], graphite, 0.002);
      for (let i = 0; i < 9; i++)
        box(
          group,
          [0.025, 0.007, 0.3],
          [-0.97 + i * 0.09, 0.742, 0.57],
          graphite,
          0.006,
        );
      for (const x of [-1.08, 1.08])
        for (const z of [-0.72, 0.72]) screw(group, x, 0.74, z);
      box(group, [0.34, 0.09, 0.019], [-0.71, 0.34, 0.923], rubber, 0.028);
      box(group, [0.24, 0.025, 0.022], [-0.71, 0.34, 0.935], aluminium, 0.009);
      box(group, [0.42, 0.13, 0.025], [0.05, 0.34, 0.923], rubber, 0.015);
      const indicator = mesh(
        group,
        new THREE.SphereGeometry(0.035, 20, 12),
        opal,
        [0.92, 0.35, 0.927],
      );
      indicator.scale.set(1, 1, 0.4);
      engraving(group, "CONVERT / PROCESS", [0.32, 0.746, 0.6], 1.25);
    } else {
      contact(group, 3.8, 3.1);
      box(group, [2.6, 0.08, 2.06], [0, 0.06, 0], aluminium, 0.045);
      for (let level = 0; level < 3; level++) {
        const y = 0.22 + level * 0.35;
        for (const x of [-1.16, 1.16])
          cylinder(group, 0.037, 0.35, [x, y - 0.06, -0.82], polished);
        box(group, [2.55, 0.045, 2], [0, y, 0], glass, 0.02);
        box(group, [0.045, 0.19, 2], [-1.25, y + 0.07, 0], glass, 0.02);
        box(group, [0.045, 0.19, 2], [1.25, y + 0.07, 0], glass, 0.02);
        box(group, [2.55, 0.19, 0.045], [0, y + 0.07, -0.98], glass, 0.02);
        box(
          group,
          [2.18, 0.026, 1.62],
          [-0.04, y + 0.045, -0.03],
          paper,
          0.008,
        );
        if (level === 2)
          topPage(
            group,
            [2.18, 1.62],
            [-0.04, y + 0.06, -0.03],
            printedPage("In progress", "05"),
          );
        box(
          group,
          [0.38, 0.025, 0.24],
          [0.68, y + 0.06, 0.82],
          level === 2 ? opal : polymer,
          0.02,
        );
      }
    }
  }
  return {
    scene,
    groups,
    dispose() {
      const geometries = new Set<THREE.BufferGeometry>(extraGeometry);
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) geometries.add(obj.geometry);
      });
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((mat) => mat.dispose());
      textures.forEach((texture) => texture.dispose());
      reflection.dispose();
      key.shadow.dispose();
    },
  };
}
