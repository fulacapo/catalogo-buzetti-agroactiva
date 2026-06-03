import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Text, Image as DreiImage, Float } from '@react-three/drei';
import * as THREE from 'three';

interface SceneProps {
  products: any[];
  activeIndex: number;
  /** Dim the whole carousel (used as a calm backdrop behind the menu). */
  dimmed?: boolean;
}

export function Scene({ products, activeIndex, dimmed = false }: SceneProps) {
  const { width } = useThree((state) => state.viewport);
  const groupRef = useRef<THREE.Group>(null);

  // Smoothly interpolate the carousel position based on activeIndex
  useFrame((state, delta) => {
    if (groupRef.current) {
      const targetX = -activeIndex * (width > 8 ? 6 : width * 0.7);
      groupRef.current.position.x = THREE.MathUtils.lerp(groupRef.current.position.x, targetX, 5 * delta);
    }
  });

  const spacing = width > 8 ? 6 : width * 0.7;

  // VIRTUALIZACIÓN: renderizar SOLO las tarjetas cercanas a la activa.
  // Con catálogos de 150+ piezas, montar todas significaba 150+ texturas en
  // memoria de video al mismo tiempo — letal para una GPU integrada (i5 5ª gen).
  // Mostrando una ventana de ±3 bajamos a ~7 texturas y ~7 loops por frame.
  const WINDOW = 3;
  const lo = Math.max(0, activeIndex - WINDOW);
  const hi = Math.min(products.length - 1, activeIndex + WINDOW);
  const visible: number[] = [];
  for (let i = lo; i <= hi; i++) visible.push(i);

  return (
    <group ref={groupRef}>
      {visible.map((index) => (
        <ProductCard
          key={products[index].codigo}
          product={products[index]}
          position={[index * spacing, 0, 0]}
          isActive={index === activeIndex}
          dimmed={dimmed}
        />
      ))}
    </group>
  );
}

function ProductCard({ product, position, isActive, dimmed }: { product: any, position: [number, number, number], isActive: boolean, dimmed: boolean }) {
  const cardRef = useRef<THREE.Mesh>(null);

  useFrame((state, delta) => {
    if (cardRef.current) {
      const targetScale = isActive ? 1.1 : 0.78;
      const targetZ = isActive ? 1 : 0;

      cardRef.current.scale.setScalar(
        THREE.MathUtils.lerp(cardRef.current.scale.x, targetScale, 4 * delta)
      );

      cardRef.current.position.z = THREE.MathUtils.lerp(
        cardRef.current.position.z, targetZ, 4 * delta
      );

      if (isActive) {
        // Slow turntable rotation — gives the "showroom" feel.
        cardRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.6) * 0.18;
      } else {
        cardRef.current.rotation.y = THREE.MathUtils.lerp(cardRef.current.rotation.y, 0, 4 * delta);
      }
    }
  });

  // Image aspect-ratio fit inside the lit frame
  const maxWidth = 2.6;
  const maxHeight = 3.7;
  const imgWidth = product.imageWidth || 864;
  const imgHeight = product.imageHeight || 1238;
  const aspect = imgWidth / imgHeight;
  const frameAspect = maxWidth / maxHeight;

  let scaleX = maxWidth;
  let scaleY = maxHeight;
  if (aspect > frameAspect) {
    scaleX = maxWidth;
    scaleY = maxWidth / aspect;
  } else {
    scaleX = maxHeight * aspect;
    scaleY = maxHeight;
  }

  const dimOpacity = dimmed ? 0.35 : 1;

  return (
    <Float floatIntensity={isActive ? 1.4 : 0.2} rotationIntensity={isActive ? 0.25 : 0.05}>
      <group position={position}>
        <mesh ref={cardRef}>
          {/* Dark metallic card body */}
          <planeGeometry args={[4, 5.5]} />
          <meshStandardMaterial
            color="#142438"
            roughness={0.5}
            metalness={0.25}
            transparent
            opacity={dimOpacity}
          />

          {/* Cyan glow border on the active card */}
          {isActive && !dimmed && (
            <mesh position={[0, 0, -0.02]}>
              <planeGeometry args={[4.18, 5.68]} />
              <meshBasicMaterial color="#00b4d8" transparent opacity={0.55} />
            </mesh>
          )}

          {/* Lit image frame (vitrine look) */}
          <mesh position={[0, 0.7, 0.02]}>
            <planeGeometry args={[2.75, 3.85]} />
            <meshStandardMaterial color="#eef4fa" roughness={0.4} metalness={0.05} transparent opacity={dimOpacity} />
          </mesh>

          {product.imageUrl ? (
            <DreiImage
              url={product.imageUrl}
              position={[0, 0.7, 0.04]}
              scale={[scaleX, scaleY]}
              transparent
              opacity={dimOpacity}
              toneMapped={false}
            />
          ) : (
            <group position={[0, 0.7, 0.04]}>
              <mesh rotation={[Math.PI / 4, Math.PI / 4, 0]}>
                <torusGeometry args={[0.55, 0.12, 16, 64]} />
                <meshStandardMaterial
                  color="#00487c"
                  roughness={0.1}
                  metalness={0.9}
                  emissive="#00b4d8"
                  emissiveIntensity={0.6}
                />
              </mesh>
              <Text position={[0, 0, 0.15]} fontSize={0.15} color="#7dd3fc">
                SIN IMAGEN
              </Text>
            </group>
          )}

          {/* Product Code */}
          <Text
            position={[0, -1.4, 0.04]}
            fontSize={0.3}
            color="#ffffff"
            anchorX="center"
            anchorY="middle"
            maxWidth={3.5}
            textAlign="center"
            fillOpacity={dimOpacity}
          >
            Ref. {product.codigo}
          </Text>

          {/* Category */}
          <Text
            position={[0, -1.86, 0.04]}
            fontSize={0.185}
            color="#7dd3fc"
            anchorX="center"
            anchorY="middle"
            maxWidth={3.5}
            textAlign="center"
            fillOpacity={dimOpacity}
          >
            {product.categoria || 'Repuesto Inyección'}
          </Text>

          {/* Description */}
          <Text
            position={[0, -2.28, 0.04]}
            fontSize={0.2}
            color="#f1f5f9"
            anchorX="center"
            anchorY="middle"
            maxWidth={3.5}
            textAlign="center"
            fillOpacity={dimOpacity}
          >
            {product.descripcion}
          </Text>

          {/* Action Prompt */}
          {isActive && !dimmed && (
            <Text
              position={[0, -2.55, 0.04]}
              fontSize={0.12}
              color="#38bdf8"
              anchorX="center"
              anchorY="middle"
            >
              PELLIZCA PARA DETALLES
            </Text>
          )}
        </mesh>
      </group>
    </Float>
  );
}
