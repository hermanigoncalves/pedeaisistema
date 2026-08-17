import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Sparkles, ShoppingBag, Loader2 } from 'lucide-react';

interface RobotMascot3DProps {
  modelUrl?: string;
  className?: string;
  showBadge?: boolean;
}

export const RobotMascot3D: React.FC<RobotMascot3DProps> = ({
  modelUrl = '/models/PedeAI_garcom_robo.glb',
  className = '',
  showBadge = true,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let isCancelled = false;
    let animationFrameId: number;

    // 1. Setup Three.js Scene, Camera, Renderer
    const scene = new THREE.Scene();
    
    const width = container.clientWidth || 300;
    const height = container.clientHeight || 300;

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.set(0, 0.4, 2.8);

    const renderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      alpha: true,
      powerPreference: 'high-performance'
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);

    // 2. Iluminação de estúdio para destacar o robô
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.4);
    scene.add(ambientLight);

    const dirLightFront = new THREE.DirectionalLight(0xffffff, 2.0);
    dirLightFront.position.set(2, 4, 3);
    scene.add(dirLightFront);

    const dirLightRim = new THREE.DirectionalLight(0x34d399, 1.8); // Luz verde esmeralda nas costas
    dirLightRim.position.set(-3, 2, -2);
    scene.add(dirLightRim);

    const dirLightFill = new THREE.DirectionalLight(0x60a5fa, 0.8); // Luz azul suave de preenchimento
    dirLightFill.position.set(0, -2, 2);
    scene.add(dirLightFill);

    // Grupo do robô para rotação e animação de flutuação
    const robotGroup = new THREE.Group();
    scene.add(robotGroup);

    // 3. Carregar modelo GLB
    const loader = new GLTFLoader();
    loader.load(
      modelUrl,
      (gltf) => {
        if (isCancelled) return;
        const model = gltf.scene;

        // Centralizar e ajustar escala do modelo
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());

        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 1.3 / maxDim;
        model.scale.set(scale, scale, scale);
        model.position.set(-center.x * scale, -center.y * scale - 0.1, -center.z * scale);

        robotGroup.add(model);
        setLoading(false);
      },
      undefined,
      (err) => {
        console.warn('[Robot3D] Erro ao carregar GLB:', err);
        if (!isCancelled) {
          setError(true);
          setLoading(false);
        }
      }
    );

    // 4. Interação com Mouse / Touch para girar o robô
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };

    const handlePointerDown = (e: PointerEvent) => {
      isDragging = true;
      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!isDragging) return;
      const deltaX = e.clientX - previousMousePosition.x;
      const deltaY = e.clientY - previousMousePosition.y;

      robotGroup.rotation.y += deltaX * 0.01;
      robotGroup.rotation.x = Math.max(-0.3, Math.min(0.3, robotGroup.rotation.x + deltaY * 0.005));

      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const handlePointerUp = () => {
      isDragging = false;
    };

    container.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    // 5. Loop de Animação (Flutuação suave + Rotação Idle contínua)
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Rotação suave automática quando o usuário não estiver arrastando
      if (!isDragging) {
        robotGroup.rotation.y += 0.008;
        // Flutuação sutil (bobbing)
        robotGroup.position.y = Math.sin(elapsedTime * 1.8) * 0.05;
      }

      renderer.render(scene, camera);
    };
    animate();

    // 6. Resize Observer
    const resizeObserver = new ResizeObserver(() => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    resizeObserver.observe(container);

    // 7. Cleanup
    return () => {
      isCancelled = true;
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      container.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);

      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [modelUrl]);

  return (
    <div className={`relative flex flex-col items-center justify-center w-full h-full select-none ${className}`}>
      
      {/* Container do Canvas 3D */}
      <div 
        ref={containerRef} 
        className="w-full h-full flex-1 flex items-center justify-center cursor-grab active:cursor-grabbing min-h-[140px]" 
      />

      {/* Loading Spinner */}
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-xs rounded-xl text-white">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-400 mb-2" />
          <span className="text-xs font-semibold text-emerald-200">Carregando Robô 3D...</span>
        </div>
      )}

      {/* Error Fallback */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 text-xs p-3 text-center">
          <Sparkles className="w-8 h-8 text-emerald-600 mb-2" />
          <span>Robô PedeAí Delivery</span>
        </div>
      )}

      {/* Placa / Letreiro Estilizado "PedeAí DELIVERY" */}
      {showBadge && (
        <div className="absolute bottom-2 z-10 flex flex-col items-center pointer-events-none animate-fade-in">
          <div className="bg-gradient-to-r from-emerald-900/90 via-emerald-800/95 to-emerald-900/90 backdrop-blur-md border border-emerald-400/50 px-4 py-1.5 rounded-full shadow-lg flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-300 animate-pulse" />
            <div className="flex items-baseline gap-1.5">
              <span className="font-black text-sm tracking-tight text-white">
                PedeAí
              </span>
              <span className="font-black text-[11px] tracking-widest text-emerald-300 uppercase bg-emerald-700/60 px-2 py-0.5 rounded-md border border-emerald-400/40 shadow-xs">
                DELIVERY
              </span>
            </div>
            <ShoppingBag className="w-3.5 h-3.5 text-emerald-300" />
          </div>
        </div>
      )}

    </div>
  );
};

export default RobotMascot3D;
