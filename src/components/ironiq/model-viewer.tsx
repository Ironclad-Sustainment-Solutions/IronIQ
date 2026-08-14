import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Loader2 } from "lucide-react";

/** Amber edge highlight matching the IronIQ accent (three.js cannot parse oklch tokens). */
const EDGE_COLOR = "#f0a63c";


/**
 * Lightweight STL viewer: orbit with drag, zoom with wheel, pan with right-drag.
 * Rendered client-only (lazy-loaded) so three.js never enters the SSR bundle.
 */
export default function ModelViewer({ url, className }: { url: string; className?: string }) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 5000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";
    renderer.domElement.style.touchAction = "none";

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;

    scene.add(new THREE.HemisphereLight(0xdfe7ef, 0x11161d, 1.15));
    const key = new THREE.DirectionalLight(0xffffff, 1.5);
    key.position.set(1, 1.4, 1.1);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xffc46b, 0.7);
    rim.position.set(-1.2, -0.6, -1);
    scene.add(rim);

    const surface = EDGE_COLOR;
    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x9fb0c0),
      metalness: 0.72,
      roughness: 0.34,
    });

    let mesh: THREE.Mesh | null = null;
    let edges: THREE.LineSegments | null = null;
    let frame = 0;
    let disposed = false;

    function resize() {
      const w = mount!.clientWidth || 1;
      const h = mount!.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }

    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    resize();

    new STLLoader().load(
      url,
      (geometry) => {
        if (disposed) {
          geometry.dispose();
          return;
        }
        geometry.computeVertexNormals();
        geometry.center();

        mesh = new THREE.Mesh(geometry, material);
        mesh.rotation.x = -Math.PI / 2;
        scene.add(mesh);

        const edgeGeom = new THREE.EdgesGeometry(geometry, 25);
        edges = new THREE.LineSegments(
          edgeGeom,
          new THREE.LineBasicMaterial({ color: new THREE.Color(surface), transparent: true, opacity: 0.5 }),
        );
        edges.rotation.copy(mesh.rotation);
        scene.add(edges);

        geometry.computeBoundingSphere();
        const radius = geometry.boundingSphere?.radius ?? 10;
        camera.position.set(radius * 1.7, radius * 1.35, radius * 2.0);
        camera.near = radius / 100;
        camera.far = radius * 100;
        camera.updateProjectionMatrix();
        controls.target.set(0, 0, 0);
        controls.minDistance = radius * 0.6;
        controls.maxDistance = radius * 8;
        controls.update();
        setLoading(false);
      },
      undefined,
      () => {
        if (!disposed) {
          setError("Unable to load the model mesh.");
          setLoading(false);
        }
      },
    );

    function tick() {
      frame = requestAnimationFrame(tick);
      controls.update();
      renderer.render(scene, camera);
    }
    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      mesh?.geometry.dispose();
      edges?.geometry.dispose();
      (edges?.material as THREE.Material | undefined)?.dispose();
      material.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, [url]);

  return (
    <div className={className}>
      <div ref={mountRef} className="relative h-full w-full">
        {loading || error ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            {error ? (
              error
            ) : (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden /> Loading geometry…
              </>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
