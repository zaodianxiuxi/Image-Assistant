import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { BokehPass } from "three/addons/postprocessing/BokehPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { createStudio, stations } from "./studioScene";
import { RotateCcw, Move, Expand } from "lucide-react";
import type { WorkspaceView } from "./types";
type Props = { onOpen: (view: WorkspaceView) => void; theme: string };
export default function SpatialDesk({ onOpen, theme }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const openRef = useRef(onOpen);
  openRef.current = onOpen;
  const reset = useRef<() => void>(() => {});
  const [fallback, setFallback] = useState(false);
  const [hovered, setHovered] = useState("");
  useEffect(() => {
    const container = host.current;
    if (!container) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "low-power",
      });
    } catch {
      setFallback(true);
      return;
    }
    setFallback(false);
    const dark = theme === "dark";
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = true;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.95;
    const studio = createStudio(
      renderer,
      dark,
      theme === "paper" || theme === "studio",
    );
    const { scene, groups } = studio;
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    const original = new THREE.Vector3(7.5, 8.8, 14.5);
    camera.position.copy(original);
    container.appendChild(renderer.domElement);
    renderer.domElement.setAttribute(
      "aria-label",
      "可旋转的材质工作桌；也可使用下方工具按钮",
    );
    renderer.domElement.setAttribute("role", "img");
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0.15, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.09;
    controls.minDistance = 10;
    controls.maxDistance = 27;
    controls.maxPolarAngle = Math.PI * 0.43;
    controls.minPolarAngle = 0.35;
    controls.enablePan = false;
    controls.rotateSpeed = 0.6;
    controls.zoomSpeed = 0.7;
    // Subtle lens blur is kept out of the DOM; text and interactive controls stay sharp.
    const renderTarget = new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.HalfFloatType,
    });
    renderTarget.samples = renderer.capabilities.isWebGL2 ? 4 : 0;
    const composer = new EffectComposer(renderer, renderTarget);
    const renderPass = new RenderPass(scene, camera);
    const bokeh = new BokehPass(scene, camera, {
      focus: original.length(),
      aperture: 0.0001,
      maxblur: 0.003,
    });
    const output = new OutputPass();
    composer.addPass(renderPass);
    composer.addPass(bokeh);
    composer.addPass(output);
    let dirty = true;
    let animation = 0,
      disposed = false,
      opening = false,
      visible = true;
    let pointerDown = { x: 0, y: 0 };
    const pointer = new THREE.Vector2(),
      raycaster = new THREE.Raycaster();
    let hoveredGroup: THREE.Group | undefined;
    let tween: {
      from: THREE.Vector3;
      to: THREE.Vector3;
      targetFrom: THREE.Vector3;
      targetTo: THREE.Vector3;
      start: number;
      destination?: WorkspaceView;
    } | null = null;
    function pick(event: PointerEvent) {
      const bounds = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
        (-(event.clientY - bounds.top) / bounds.height) * 2 + 1,
      );
      raycaster.setFromCamera(pointer, camera);
      for (const hit of raycaster.intersectObjects(groups, true)) {
        let object: THREE.Object3D | null = hit.object;
        if (object instanceof THREE.Sprite) continue;
        while (object && !object.userData.tool) object = object.parent;
        if (object) return object as THREE.Group;
      }
      return undefined;
    }
    const down = (event: PointerEvent) => {
      pointerDown = { x: event.clientX, y: event.clientY };
    };
    const move = (event: PointerEvent) => {
      if (opening) return;
      hoveredGroup = pick(event);
      renderer.domElement.style.cursor = hoveredGroup ? "pointer" : "grab";
      setHovered(
        stations.find((s) => s.id === hoveredGroup?.userData.tool)?.label || "",
      );
    };
    const leave = () => {
      hoveredGroup = undefined;
      setHovered("");
    };
    const up = (event: PointerEvent) => {
      if (
        opening ||
        Math.hypot(
          event.clientX - pointerDown.x,
          event.clientY - pointerDown.y,
        ) > 6
      )
        return;
      const selected = pick(event);
      if (!selected) return;
      opening = true;
      controls.enabled = false;
      const target = selected.position
        .clone()
        .add(new THREE.Vector3(0, 0.5, 0));
      tween = {
        from: camera.position.clone(),
        to: target.clone().add(new THREE.Vector3(3, 4, 5)),
        targetFrom: controls.target.clone(),
        targetTo: target,
        start: performance.now(),
        destination: selected.userData.tool,
      };
      if (matchMedia("(prefers-reduced-motion: reduce)").matches)
        openRef.current(selected.userData.tool);
    };
    reset.current = () => {
      opening = false;
      controls.enabled = true;
      tween = {
        from: camera.position.clone(),
        to: original.clone(),
        targetFrom: controls.target.clone(),
        targetTo: new THREE.Vector3(0, 0.1, 0),
        start: performance.now(),
      };
    };
    function resize() {
      const bounds = container!.getBoundingClientRect();
      renderer.setSize(bounds.width, Math.max(1, bounds.height));
      composer.setSize(bounds.width, Math.max(1, bounds.height));
      bokeh.enabled = bounds.width > 600;
      dirty = true;
      camera.aspect = bounds.width / Math.max(1, bounds.height);
      // Keep the entire desk in view when a narrow screen reduces horizontal space.
      camera.fov = THREE.MathUtils.radToDeg(
        2 *
          Math.atan(
            Math.tan(THREE.MathUtils.degToRad(32) / 2) *
              Math.max(1, 1.65 / camera.aspect),
          ),
      );
      camera.updateProjectionMatrix();
    }
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    function render() {
      if (disposed || !visible) return;
      animation = requestAnimationFrame(render);
      let moving = Boolean(tween);
      if (tween) {
        const t = preference.matches
          ? 1
          : Math.min(1, (performance.now() - tween.start) / 650);
        const eased = 1 - Math.pow(1 - t, 3);
        camera.position.lerpVectors(tween.from, tween.to, eased);
        controls.target.lerpVectors(tween.targetFrom, tween.targetTo, eased);
        if (t === 1) {
          const destination = tween.destination;
          tween = null;
          if (destination) openRef.current(destination);
        }
      }
      for (const group of groups) {
        const target = group === hoveredGroup ? 0.025 : 0;
        if (Math.abs(group.position.y - target) > 0.0002) moving = true;
        group.position.y = preference.matches
          ? target
          : THREE.MathUtils.lerp(group.position.y, target, 0.12);
      }
      const cameraMoved = controls.update();
      if (dirty || moving || cameraMoved) {
        if (moving) renderer.shadowMap.needsUpdate = true;
        bokeh.materialBokeh.uniforms["focus"].value =
          camera.position.distanceTo(controls.target);
        composer.render();
        dirty = false;
      }
    }
    function visibility() {
      visible = !document.hidden;
      cancelAnimationFrame(animation);
      if (visible) {
        dirty = true;
        render();
      }
    }
    document.addEventListener("visibilitychange", visibility);
    renderer.domElement.addEventListener("pointerdown", down);
    renderer.domElement.addEventListener("pointermove", move);
    renderer.domElement.addEventListener("pointerup", up);
    renderer.domElement.addEventListener("pointerleave", leave);
    const contextLost = (e: Event) => {
      e.preventDefault();
      setFallback(true);
      cancelAnimationFrame(animation);
    };
    renderer.domElement.addEventListener("webglcontextlost", contextLost);
    render();
    return () => {
      disposed = true;
      cancelAnimationFrame(animation);
      observer.disconnect();
      document.removeEventListener("visibilitychange", visibility);
      controls.dispose();
      renderer.domElement.removeEventListener("pointerdown", down);
      renderer.domElement.removeEventListener("pointermove", move);
      renderer.domElement.removeEventListener("pointerup", up);
      renderer.domElement.removeEventListener("pointerleave", leave);
      renderer.domElement.removeEventListener("webglcontextlost", contextLost);
      bokeh.dispose();
      output.dispose();
      renderPass.dispose();
      composer.dispose();
      studio.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [theme]);
  return (
    <div className="spatial-scene">
      <div className="spatial-canvas" ref={host} />
      {fallback && (
        <div className="spatial-fallback">
          <Expand size={34} />
          <h3>从下方选择一个工作区</h3>
          <p>当前设备未能启用 3D，文件和创作工具仍可正常使用。</p>
        </div>
      )}
      <div className="spatial-instructions">
        <span>
          <Move size={14} />
          {hovered
            ? "点击打开「" + hovered + "」"
            : "拖动旋转 · 滚轮缩放 · 点击物件进入"}
        </span>
        <button type="button" onClick={() => reset.current()}>
          <RotateCcw size={14} />
          重置视角
        </button>
      </div>
    </div>
  );
}
