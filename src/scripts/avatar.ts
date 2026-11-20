/**
 * Three.js avatar viewer.
 *
 * Loaded lazily — the module is only imported when the Lab section approaches
 * the viewport, so the 1 MB model never competes with the frame sequence for
 * bandwidth on first paint.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'meshoptimizer';

interface AvatarOptions {
  stage: HTMLElement;
  fallback: HTMLElement;
  onReady?: () => void;
}

export function initAvatar({ stage, fallback, onReady }: AvatarOptions): void {
  const observer = new IntersectionObserver(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      void boot();
    },
    { rootMargin: '400px 0px' },
  );

  observer.observe(stage);

  async function boot() {
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    } catch {
      fallback.hidden = false;
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = false;
    stage.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);

    /* --- Studio rig: key, fill, rim ----------------------------------- */
    const key = new THREE.DirectionalLight(0xfff2e0, 3.4);
    key.position.set(2.4, 3.2, 3.4);
    scene.add(key);

    const fill = new THREE.DirectionalLight(0x9fb4d8, 1.1);
    fill.position.set(-3.2, 0.6, 2.2);
    scene.add(fill);

    const rim = new THREE.DirectionalLight(0xc9955f, 3.0);
    rim.position.set(-1.4, 1.8, -3.6);
    scene.add(rim);

    scene.add(new THREE.AmbientLight(0x3a3a46, 1.4));

    /* --- Load --------------------------------------------------------- */
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);

    let model: THREE.Object3D | null = null;
    let baseY = 0;
    let headTop = 1.05;
    let chestY = 0.3;

    try {
      const gltf = await loader.loadAsync('/models/avatar.glb');
      model = gltf.scene;

      // Normalise to a 2.1-unit figure centred on the origin.
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const centre = box.getCenter(new THREE.Vector3());

      const targetHeight = 2.1;
      const scale = targetHeight / Math.max(size.y, 0.001);
      model.scale.setScalar(scale);

      model.position.set(-centre.x * scale, -centre.y * scale, -centre.z * scale);
      baseY = model.position.y;

      // The head occupies the top ~18% of the figure.
      headTop = size.y * 0.5 * scale;
      chestY = size.y * 0.14 * scale;

      model.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.frustumCulled = false;
          const material = child.material;
          if (material instanceof THREE.MeshStandardMaterial) {
            material.envMapIntensity = 0.6;
            material.needsUpdate = true;
          }
        }
      });

      scene.add(model);
      onReady?.();
    } catch {
      fallback.hidden = false;
      return;
    }

    /* --- Interaction -------------------------------------------------- */
    const pointer = { x: 0, y: 0 };
    const target = { x: 0, y: 0 };
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let interacted = false;

    const markInteracted = () => {
      if (interacted) return;
      interacted = true;
      stage.setAttribute('data-interacted', 'true');
    };

    stage.addEventListener('pointerdown', (event) => {
      dragging = true;
      lastX = event.clientX;
      lastY = event.clientY;
      stage.setPointerCapture(event.pointerId);
      markInteracted();
    });

    stage.addEventListener('pointermove', (event) => {
      if (!dragging) return;
      target.y += (event.clientX - lastX) * 0.006;
      target.x += (event.clientY - lastY) * 0.004;
      target.x = Math.max(-0.5, Math.min(0.5, target.x));
      lastX = event.clientX;
      lastY = event.clientY;
    });

    const endDrag = (event: PointerEvent) => {
      dragging = false;
      if (stage.hasPointerCapture(event.pointerId)) stage.releasePointerCapture(event.pointerId);
    };
    stage.addEventListener('pointerup', endDrag);
    stage.addEventListener('pointercancel', endDrag);

    // Idle drift so the model never looks frozen.
    stage.addEventListener('pointerleave', () => {
      dragging = false;
    });

    /* --- Resize ------------------------------------------------------- */
    function resize() {
      const rect = stage.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      renderer.setSize(rect.width, rect.height, false);
      camera.aspect = rect.width / rect.height;

      // Frame a bust: from just above the head down to the chest. The model is
      // a static T-pose, so cropping above the arms reads as a deliberate
      // portrait rather than a rig that failed to load.
      const top = headTop + 0.06;
      const bottom = chestY;
      const frameHeight = top - bottom;
      const frameCentre = (top + bottom) / 2;

      const vFov = (camera.fov * Math.PI) / 180;
      const distance = frameHeight / (2 * Math.tan(vFov / 2));

      camera.position.set(0, frameCentre, distance);
      camera.lookAt(0, frameCentre, 0);
      camera.updateProjectionMatrix();
    }

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(stage);
    resize();

    /* --- Loop --------------------------------------------------------- */
    const clock = new THREE.Clock();
    let visible = true;

    const visibilityObserver = new IntersectionObserver(
      (entries) => {
        visible = entries.some((entry) => entry.isIntersecting);
      },
      { rootMargin: '120px' },
    );
    visibilityObserver.observe(stage);

    function animate() {
      requestAnimationFrame(animate);
      if (!visible || !model) return;

      const elapsed = clock.getElapsedTime();

      // Damped follow toward the pointer-driven target.
      pointer.x += (target.x - pointer.x) * 0.06;
      pointer.y += (target.y - pointer.y) * 0.06;

      const idle = dragging ? 0 : Math.sin(elapsed * 0.35) * 0.06;

      model.rotation.y = pointer.y + idle;
      model.rotation.x = pointer.x * 0.6;
      model.position.y = baseY + Math.sin(elapsed * 0.8) * 0.012;

      renderer.render(scene, camera);
    }

    animate();
  }
}
