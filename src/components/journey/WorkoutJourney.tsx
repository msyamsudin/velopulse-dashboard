'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Bike, Gauge, Heart, Mountain, Radio, Zap } from 'lucide-react';
import { getJourneyVisualState, type JourneyTelemetry } from '@/lib/journey-metrics';

interface WorkoutJourneyProps {
  telemetry: JourneyTelemetry;
  elapsed: number;
  maxHeartRate: number;
  bikeConnected: boolean;
}

const SKY_COLOR = 0x030712;
const FOG_COLOR = 0x07111d;
const ROAD_COLOR = 0x07090d;
const ASPHALT_COLOR = 0x111820;
const CREAM = 0xe9d8bd;
const WOOD = 0x70492e;
const DARK_TRIM = 0x101923;
const ROOF_COLORS = [0xa7433a, 0x1e4054, 0x8b3d4a, 0x2c3d46];
const ACCENT_COLORS = [0x7690a4, 0x35f0bd, 0xf5c542, 0xfb923c, 0xf05252];
const SEGMENT_COUNT = 18;
const SEGMENT_LENGTH = 18;
const ROAD_HALF_WIDTH = 3.2;

const disposeObject = (object: THREE.Object3D) => {
  object.traverse(child => {
    if (
      !(child instanceof THREE.Mesh) &&
      !(child instanceof THREE.Points) &&
      !(child instanceof THREE.Line) &&
      !(child instanceof THREE.LineSegments)
    ) return;

    child.geometry?.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach(material => {
      const withMaps = material as THREE.Material & { map?: THREE.Texture };
      withMaps.map?.dispose();
      material?.dispose();
    });
  });
};

const standardMaterial = (color: number, options: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({
    color,
    roughness: 0.62,
    metalness: 0.04,
    ...options
  });

const basicGlowMaterial = (color: number, opacity = 1) =>
  new THREE.MeshBasicMaterial({
    color,
    transparent: opacity < 1,
    opacity,
    blending: THREE.AdditiveBlending
  });

const addBox = (
  group: THREE.Group,
  size: [number, number, number],
  position: [number, number, number],
  material: THREE.Material,
  castShadow = true
) => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
};

const createSignTexture = (label: string, color = '#17212c', background = '#f6e6cd', accent = '#d45a4d') => {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 192;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, 26, canvas.height);
  ctx.fillRect(canvas.width - 26, 0, 26, canvas.height);
  ctx.strokeStyle = 'rgba(23,33,44,0.24)';
  ctx.lineWidth = 10;
  ctx.strokeRect(22, 22, canvas.width - 44, canvas.height - 44);
  ctx.fillStyle = color;
  ctx.font = '700 54px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
};

const createMoonTexture = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const center = canvas.width / 2;
  const radius = canvas.width * 0.47;
  const base = ctx.createRadialGradient(center - 70, center - 80, 25, center, center, radius);
  base.addColorStop(0, '#fff8ea');
  base.addColorStop(0.48, '#dedbd2');
  base.addColorStop(0.82, '#b4bac0');
  base.addColorStop(1, '#7e8994');

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.beginPath();
  ctx.arc(center, center, radius, 0, Math.PI * 2);
  ctx.fillStyle = base;
  ctx.fill();

  const craters = [
    [178, 178, 27, 0.18],
    [315, 184, 36, 0.14],
    [246, 273, 49, 0.12],
    [350, 316, 22, 0.16],
    [157, 320, 31, 0.13],
    [285, 366, 19, 0.12],
    [220, 130, 13, 0.12],
    [386, 240, 15, 0.14],
    [134, 246, 18, 0.12]
  ] as const;

  craters.forEach(([x, y, craterRadius, opacity]) => {
    const crater = ctx.createRadialGradient(x - craterRadius * 0.28, y - craterRadius * 0.28, 2, x, y, craterRadius);
    crater.addColorStop(0, `rgba(255,255,255,${opacity * 0.72})`);
    crater.addColorStop(0.45, `rgba(83,92,102,${opacity * 0.72})`);
    crater.addColorStop(1, 'rgba(95,103,112,0)');
    ctx.fillStyle = crater;
    ctx.beginPath();
    ctx.arc(x, y, craterRadius, 0, Math.PI * 2);
    ctx.fill();
  });

  const maria = [
    [224, 218, 86, 42, -0.35, 0.11],
    [318, 270, 72, 34, 0.28, 0.1],
    [207, 346, 66, 26, 0.2, 0.08]
  ] as const;

  maria.forEach(([x, y, width, height, rotation, opacity]) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.scale(width / height, 1);
    ctx.fillStyle = `rgba(82,91,102,${opacity * 0.72})`;
    ctx.beginPath();
    ctx.arc(0, 0, height, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  const edge = ctx.createRadialGradient(center, center, radius * 0.58, center, center, radius);
  edge.addColorStop(0, 'rgba(0,0,0,0)');
  edge.addColorStop(0.78, 'rgba(0,0,0,0.05)');
  edge.addColorStop(1, 'rgba(0,0,0,0.28)');
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = edge;
  ctx.beginPath();
  ctx.arc(center, center, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
};

const addRoof = (group: THREE.Group, width: number, depth: number, y: number, color: number) => {
  const roof = new THREE.Mesh(
    new THREE.CylinderGeometry(0, width * 0.76, depth, 4, 1),
    standardMaterial(color, { roughness: 0.78 })
  );
  roof.rotation.y = Math.PI / 4;
  roof.scale.z = 0.42;
  roof.position.y = y;
  roof.castShadow = true;
  roof.receiveShadow = true;
  group.add(roof);

  const ribMaterial = standardMaterial(0x7e2f2b, { roughness: 0.9 });
  for (let i = -3; i <= 3; i += 1) {
    const rib = new THREE.Mesh(new THREE.BoxGeometry(0.045, depth * 0.96, 0.08), ribMaterial);
    rib.rotation.x = Math.PI / 2;
    rib.position.set(i * width * 0.14, 0.08, 0);
    roof.add(rib);
  }
};

const createStorefront = (label: string, width: number, depth: number, height: number, variant: number) => {
  const group = new THREE.Group();
  const wall = standardMaterial(variant % 2 ? 0xe2cfb7 : CREAM, { roughness: 0.82 });
  const trim = standardMaterial(DARK_TRIM, { roughness: 0.74 });
  const wood = standardMaterial(WOOD, { roughness: 0.74 });
  const windowMat = standardMaterial(0xf5c98c, {
    emissive: 0x8b4c21,
    emissiveIntensity: 0.2,
    roughness: 0.28
  });

  addBox(group, [width, height, depth], [0, height / 2, 0], wall);
  addBox(group, [width + 0.28, 0.18, depth + 0.34], [0, height + 0.08, 0], trim);
  addBox(group, [width + 0.18, 0.16, depth + 0.18], [0, 0.08, 0], trim);
  addRoof(group, width + 0.62, depth + 0.72, height + 0.56, ROOF_COLORS[variant % ROOF_COLORS.length]);

  const balconyY = Math.max(1.7, height * 0.44);
  addBox(group, [width + 0.12, 0.12, 0.34], [0, balconyY, depth / 2 + 0.22], wood);
  for (let i = 0; i < 6; i += 1) {
    addBox(group, [0.06, 0.48, 0.07], [
      -width / 2 + 0.32 + i * ((width - 0.64) / 5),
      balconyY + 0.28,
      depth / 2 + 0.36
    ], wood);
  }

  const columns = Math.max(2, Math.floor(width / 0.88));
  const floors = Math.max(1, Math.floor(height / 1.15) - 1);
  for (let floor = 0; floor < floors; floor += 1) {
    for (let column = 0; column < columns; column += 1) {
      addBox(group, [0.46, 0.38, 0.05], [
        (column - (columns - 1) / 2) * 0.74,
        1.35 + floor * 0.78,
        depth / 2 + 0.03
      ], windowMat, false);
    }
  }

  const signTexture = createSignTexture(label);
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(width * 0.72, 0.62),
    new THREE.MeshBasicMaterial({ map: signTexture || undefined, side: THREE.DoubleSide })
  );
  sign.position.set(0, 0.82, depth / 2 + 0.07);
  group.add(sign);

  return group;
};

const createPlant = (x: number, z: number, scale = 1) => {
  const group = new THREE.Group();
  addBox(group, [0.48, 0.22, 0.48], [0, 0.11, 0], standardMaterial(0x6b3c29));
  const leafMaterial = standardMaterial(0x3e8f5a, { roughness: 0.92 });
  for (let i = 0; i < 7; i += 1) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), leafMaterial);
    leaf.scale.set(1.2, 0.68, 0.96);
    leaf.position.set(Math.cos(i * 1.5) * 0.18, 0.36 + (i % 3) * 0.07, Math.sin(i * 1.9) * 0.18);
    leaf.castShadow = true;
    group.add(leaf);
  }
  group.position.set(x, 0, z);
  group.scale.setScalar(scale);
  return group;
};

const createSegment = (index: number) => {
  const segment = new THREE.Group();

  const road = new THREE.Mesh(
    new THREE.PlaneGeometry(ROAD_HALF_WIDTH * 2, SEGMENT_LENGTH + 0.2),
    standardMaterial(ASPHALT_COLOR, { roughness: 0.96 })
  );
  road.rotation.x = -Math.PI / 2;
  road.receiveShadow = true;
  segment.add(road);

  const laneMat = basicGlowMaterial(0xe9f7ff, 0.22);
  const lane = new THREE.Mesh(new THREE.PlaneGeometry(0.055, SEGMENT_LENGTH * 0.45), laneMat);
  lane.rotation.x = -Math.PI / 2;
  lane.position.set(0, 0.018, -SEGMENT_LENGTH * 0.14);
  segment.add(lane);

  const curbMat = standardMaterial(0xd7d2c7, { roughness: 0.9 });
  addBox(segment, [0.1, 0.12, SEGMENT_LENGTH + 0.2], [-ROAD_HALF_WIDTH - 0.05, 0.06, 0], curbMat, false);
  addBox(segment, [0.1, 0.12, SEGMENT_LENGTH + 0.2], [ROAD_HALF_WIDTH + 0.05, 0.06, 0], curbMat, false);

  const labels = ['RAMEN', 'VELO', 'NEKO', 'CAFE', 'SUSHI', 'TOKYO'];
  for (let side = -1; side <= 1; side += 2) {
    const buildingCount = index % 3 === 0 ? 2 : 1;
    for (let b = 0; b < buildingCount; b += 1) {
      const width = 2.2 + ((index + b) % 3) * 0.48;
      const depth = 2.0 + ((index + b * 2) % 3) * 0.34;
      const height = 2.6 + ((index + b + (side > 0 ? 1 : 0)) % 4) * 0.55;
      const building = createStorefront(labels[(index + b + (side > 0 ? 2 : 0)) % labels.length], width, depth, height, index + b);
      building.position.set(side * (ROAD_HALF_WIDTH + 1.7 + b * 2.05), 0, -4.2 + b * 5.6 + (index % 2) * 1.4);
      building.rotation.y = side > 0 ? -0.08 : 0.08;
      segment.add(building);
    }

    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.08, 5.8, 9),
      standardMaterial(0x51301e, { roughness: 0.8 })
    );
    pole.position.set(side * (ROAD_HALF_WIDTH + 0.52), 2.9, -6.2 + (index % 4) * 2.1);
    pole.castShadow = true;
    segment.add(pole);

    segment.add(createPlant(side * (ROAD_HALF_WIDTH + 0.88), 5.2 - (index % 3) * 2.2, 0.72));
  }

  return segment;
};

const createBikeAvatar = () => {
  const group = new THREE.Group();
  const frameMat = standardMaterial(0x172434, { metalness: 0.62, roughness: 0.28 });
  const accentMat = basicGlowMaterial(0x35f0bd, 0.94);
  const tireMat = standardMaterial(0x05070a, { roughness: 0.5 });
  const riderMat = standardMaterial(0xe7dccd, { roughness: 0.55 });

  const wheelGeo = new THREE.TorusGeometry(0.48, 0.045, 10, 48);
  const frontWheel = new THREE.Mesh(wheelGeo, tireMat);
  const rearWheel = frontWheel.clone();
  frontWheel.position.set(0.72, 0.52, 0);
  rearWheel.position.set(-0.72, 0.52, 0);
  frontWheel.rotation.y = Math.PI / 2;
  rearWheel.rotation.y = Math.PI / 2;
  frontWheel.castShadow = true;
  rearWheel.castShadow = true;
  group.add(frontWheel, rearWheel);

  const tubeGeo = new THREE.CylinderGeometry(0.035, 0.035, 1, 8);
  const makeTube = (from: THREE.Vector3, to: THREE.Vector3, material: THREE.Material) => {
    const midpoint = from.clone().lerp(to, 0.5);
    const direction = to.clone().sub(from);
    const tube = new THREE.Mesh(tubeGeo, material);
    tube.position.copy(midpoint);
    tube.scale.y = direction.length();
    tube.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    tube.castShadow = true;
    group.add(tube);
    return tube;
  };

  const rear = new THREE.Vector3(-0.72, 0.52, 0);
  const front = new THREE.Vector3(0.72, 0.52, 0);
  const seat = new THREE.Vector3(-0.23, 1.24, 0);
  const handle = new THREE.Vector3(0.55, 1.18, 0);
  const crank = new THREE.Vector3(-0.1, 0.74, 0);
  makeTube(rear, seat, frameMat);
  makeTube(front, handle, frameMat);
  makeTube(seat, handle, frameMat);
  makeTube(rear, crank, frameMat);
  makeTube(front, crank, frameMat);
  makeTube(crank, seat, frameMat);

  const riderTorso = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.58, 8, 12), riderMat);
  riderTorso.position.set(-0.06, 1.55, 0);
  riderTorso.rotation.z = -0.38;
  riderTorso.castShadow = true;
  const riderHead = new THREE.Mesh(new THREE.SphereGeometry(0.16, 18, 12), riderMat);
  riderHead.position.set(0.1, 1.98, 0);
  riderHead.castShadow = true;
  group.add(riderTorso, riderHead);

  const light = new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 10), accentMat);
  light.position.set(0.92, 0.9, 0.02);
  group.add(light);

  group.userData.frontWheel = frontWheel;
  group.userData.rearWheel = rearWheel;
  group.userData.accentMat = accentMat;
  group.userData.light = light;
  group.position.set(0, 0.16, 5.2);
  group.rotation.y = Math.PI;
  group.scale.setScalar(1.15);

  return group;
};

export const WorkoutJourney = ({
  telemetry,
  elapsed,
  maxHeartRate,
  bikeConnected
}: WorkoutJourneyProps) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const telemetryRef = useRef({ telemetry, maxHeartRate, bikeConnected });
  const paceMultiplierRef = useRef(1);
  const [webGlError, setWebGlError] = useState(false);
  const [paceMultiplier, setPaceMultiplier] = useState(1);
  const visualState = getJourneyVisualState(telemetry, maxHeartRate, bikeConnected);
  const adjustedVelocity = Math.min(72, visualState.velocity * paceMultiplier);
  const zoneLabel = visualState.hrZone < 0 ? 'SCOUTING' : `ZONE ${visualState.hrZone + 1}`;

  useEffect(() => {
    telemetryRef.current = { telemetry, maxHeartRate, bikeConnected };
  }, [telemetry, maxHeartRate, bikeConnected]);

  useEffect(() => {
    paceMultiplierRef.current = paceMultiplier;
  }, [paceMultiplier]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    } catch {
      setWebGlError(true);
      return;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 420);
    camera.position.set(0, 4.4, 10.4);
    camera.lookAt(0, 1.6, -16);

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.65));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    scene.background = new THREE.Color(SKY_COLOR);
    scene.fog = new THREE.Fog(FOG_COLOR, 24, 150);

    const ambient = new THREE.HemisphereLight(0x6c86a6, 0x030507, 1.2);
    const moonLight = new THREE.DirectionalLight(0xb7d5ff, 2.2);
    moonLight.position.set(-9, 15, 7);
    moonLight.castShadow = true;
    moonLight.shadow.mapSize.set(1536, 1536);
    moonLight.shadow.camera.left = -16;
    moonLight.shadow.camera.right = 16;
    moonLight.shadow.camera.top = 16;
    moonLight.shadow.camera.bottom = -16;
    const cityGlow = new THREE.PointLight(0x35f0bd, 1.6, 28, 1.8);
    cityGlow.position.set(0, 4.2, -10);
    scene.add(ambient, moonLight, cityGlow);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(90, 380),
      standardMaterial(ROAD_COLOR, { roughness: 1 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -0.03, -140);
    ground.receiveShadow = true;
    scene.add(ground);

    const segments: THREE.Group[] = [];
    for (let index = 0; index < SEGMENT_COUNT; index += 1) {
      const segment = createSegment(index);
      segment.position.z = -index * SEGMENT_LENGTH;
      scene.add(segment);
      segments.push(segment);
    }

    const bike = createBikeAvatar();
    scene.add(bike);

    const moonGroup = new THREE.Group();
    const moonHaloMaterial = basicGlowMaterial(0xbed9ff, 0.06);
    const moonHalo = new THREE.Mesh(new THREE.CircleGeometry(7.6, 64), moonHaloMaterial);
    moonHalo.position.z = -0.04;
    const moonTexture = createMoonTexture();
    const moonMaterial = new THREE.MeshBasicMaterial({
      map: moonTexture || undefined,
      color: 0xdde6ef,
      transparent: true,
      opacity: 0.96,
      depthWrite: false
    });
    const moon = new THREE.Mesh(new THREE.CircleGeometry(6.7, 72), moonMaterial);
    moonGroup.add(moonHalo, moon);
    moonGroup.position.set(-11.4, 20.8, -88);
    scene.add(moonGroup);

    const starGeometry = new THREE.BufferGeometry();
    const starPositions = new Float32Array(190 * 3);
    for (let i = 0; i < 190; i += 1) {
      starPositions[i * 3] = (Math.random() - 0.5) * 90;
      starPositions[i * 3 + 1] = 8 + Math.random() * 35;
      starPositions[i * 3 + 2] = -Math.random() * 210 + 14;
    }
    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starMaterial = new THREE.PointsMaterial({ color: 0xaac6dd, size: 0.1, transparent: true, opacity: 0.58 });
    const stars = new THREE.Points(starGeometry, starMaterial);
    scene.add(stars);

    const speedLineCount = 28;
    const speedLineGeometry = new THREE.BufferGeometry();
    const speedLinePositions = new Float32Array(speedLineCount * 2 * 3);
    const speedLineSpeeds = new Float32Array(speedLineCount);
    for (let i = 0; i < speedLineCount; i += 1) {
      const x = (Math.random() - 0.5) * 18;
      const y = 0.5 + Math.random() * 7;
      const z = -Math.random() * 120;
      speedLinePositions[i * 6] = x;
      speedLinePositions[i * 6 + 1] = y;
      speedLinePositions[i * 6 + 2] = z;
      speedLinePositions[i * 6 + 3] = x;
      speedLinePositions[i * 6 + 4] = y;
      speedLinePositions[i * 6 + 5] = z - 3.2;
      speedLineSpeeds[i] = 0.8 + Math.random() * 0.7;
    }
    speedLineGeometry.setAttribute('position', new THREE.BufferAttribute(speedLinePositions, 3));
    const speedLineMaterial = new THREE.LineBasicMaterial({ color: 0x35f0bd, transparent: true, opacity: 0 });
    const speedLines = new THREE.LineSegments(speedLineGeometry, speedLineMaterial);
    scene.add(speedLines);

    const clock = new THREE.Clock();
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let elapsedTime = 0;
    let distance = 0;
    let smoothVelocity = 2.4;
    let smoothGrade = 0;
    let checkpointFlash = 0;
    let animationFrame = 0;

    const resize = () => {
      const width = mount.clientWidth;
      const height = mount.clientHeight;
      if (width === 0 || height === 0) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);
    resize();

    const animate = () => {
      animationFrame = requestAnimationFrame(animate);
      const delta = Math.min(clock.getDelta(), 0.05);
      elapsedTime += delta;

      const latest = telemetryRef.current;
      const telemetryTarget = getJourneyVisualState(latest.telemetry, latest.maxHeartRate, latest.bikeConnected);
      const target = {
        ...telemetryTarget,
        velocity: Math.min(72, telemetryTarget.velocity * paceMultiplierRef.current)
      };
      const smoothing = 1 - Math.exp(-delta * 2.4);
      smoothVelocity = THREE.MathUtils.lerp(smoothVelocity, target.velocity, smoothing);
      smoothGrade = THREE.MathUtils.lerp(smoothGrade, target.grade, smoothing);
      const movement = smoothVelocity * delta * (reducedMotion ? 0.35 : 1);
      distance += movement;

      segments.forEach((segment, index) => {
        const previousZ = segment.position.z;
        segment.position.z += movement;
        if (segment.position.z > SEGMENT_LENGTH) segment.position.z -= SEGMENT_COUNT * SEGMENT_LENGTH;
        const worldDistance = distance - segment.position.z;
        segment.position.x = Math.sin(worldDistance * 0.014) * 0.78;
        segment.rotation.z = Math.sin(worldDistance * 0.014) * 0.018;
        segment.position.y = Math.sin(worldDistance * 0.018) * 0.14 + smoothGrade * index * 0.018;

        if (previousZ < 4 && segment.position.z >= 4) {
          checkpointFlash = 1;
        }
      });

      const bpm = latest.telemetry.heartRate || 72;
      const hrPeriod = 60 / bpm;
      const hrPulse = Math.pow(Math.sin((elapsedTime / hrPeriod) * Math.PI * 2) * 0.5 + 0.5, 4);
      const zone = target.hrZone < 0 ? 0 : target.hrZone;
      const accent = new THREE.Color(ACCENT_COLORS[zone]);

      const night = new THREE.Color(SKY_COLOR).multiplyScalar(0.9 + Math.sin(elapsedTime * 0.05) * 0.05);
      scene.background = scene.background instanceof THREE.Color ? scene.background.lerp(night, delta * 0.3) : night;
      scene.fog?.color.lerp(new THREE.Color(FOG_COLOR).multiplyScalar(0.95 + hrPulse * 0.05), delta * 0.5);

      moonMaterial.color.lerp(new THREE.Color(0xdde6ef), delta * 0.9);
      moonMaterial.opacity = 0.9 + hrPulse * 0.04;
      moonHaloMaterial.color.lerp(accent.clone().lerp(new THREE.Color(0xbed9ff), 0.78), delta * 1.2);
      moonHaloMaterial.opacity = 0.04 + hrPulse * 0.025;
      moonGroup.scale.setScalar(1 + hrPulse * 0.012);
      starMaterial.opacity = 0.45 + Math.sin(elapsedTime * 0.35) * 0.12;
      cityGlow.color.lerp(accent, delta * 2);
      cityGlow.intensity = 1.2 + target.intensity * 1.45 + hrPulse * 0.35 + checkpointFlash * 1.8;

      const frontWheel = bike.userData.frontWheel as THREE.Mesh;
      const rearWheel = bike.userData.rearWheel as THREE.Mesh;
      const accentMat = bike.userData.accentMat as THREE.MeshBasicMaterial;
      const headLight = bike.userData.light as THREE.Mesh;
      frontWheel.rotation.x -= movement * 1.8;
      rearWheel.rotation.x -= movement * 1.8;
      bike.position.x = Math.sin((distance + 8) * 0.014) * 0.45;
      bike.position.y = 0.16 + Math.sin(elapsedTime * (2 + target.intensity)) * 0.035 + smoothGrade * 0.45;
      bike.rotation.z = THREE.MathUtils.lerp(bike.rotation.z, -Math.cos(distance * 0.014) * 0.08, smoothing * 1.5);
      accentMat.color.lerp(accent, delta * 2.2);
      accentMat.opacity = 0.72 + Math.min(target.intensity, 1) * 0.22 + hrPulse * 0.06;
      headLight.scale.setScalar(1 + target.intensity * 0.5 + hrPulse * 0.12);

      const speedAttr = speedLineGeometry.getAttribute('position') as THREE.BufferAttribute;
      const speedArr = speedAttr.array as Float32Array;
      const speedFactor = THREE.MathUtils.clamp((smoothVelocity - 8) / 18, 0, 1);
      speedLineMaterial.color.lerp(accent, delta * 1.2);
      speedLineMaterial.opacity = speedFactor * 0.55;
      for (let i = 0; i < speedLineCount; i += 1) {
        let zStart = speedArr[i * 6 + 2] + movement * 2.4 * speedLineSpeeds[i];
        if (zStart > 9) {
          zStart = -120 - Math.random() * 40;
          const x = (Math.random() - 0.5) * 18;
          const y = 0.7 + Math.random() * 7;
          speedArr[i * 6] = x;
          speedArr[i * 6 + 1] = y;
          speedArr[i * 6 + 3] = x;
          speedArr[i * 6 + 4] = y;
        }
        speedArr[i * 6 + 2] = zStart;
        speedArr[i * 6 + 5] = zStart - 3.2 * (1 + speedFactor * 1.8);
      }
      speedAttr.needsUpdate = true;

      checkpointFlash = Math.max(0, checkpointFlash - delta * 2.4);
      ambient.intensity = 1.2 + checkpointFlash * 1.2;
      moonLight.intensity = 2.2 + checkpointFlash * 1.4;

      let shakeX = 0;
      let shakeY = 0;
      const powerExcess = Math.max(0, latest.telemetry.power - 240);
      if (powerExcess > 0) {
        const shakeIntensity = Math.min(1, powerExcess / 260) * 0.055;
        shakeX = Math.sin(elapsedTime * 48) * shakeIntensity;
        shakeY = Math.cos(elapsedTime * 41) * shakeIntensity * 0.65;
      }

      camera.position.x = THREE.MathUtils.lerp(camera.position.x, bike.position.x * 0.42, smoothing) + shakeX;
      camera.position.y = THREE.MathUtils.lerp(camera.position.y, 4.4 + smoothGrade * 0.8, smoothing) + shakeY;
      camera.position.z = THREE.MathUtils.lerp(camera.position.z, 10.4, smoothing);
      camera.lookAt(
        Math.sin((distance + 28) * 0.014) * 0.8,
        1.7 + smoothGrade,
        -15
      );

      stars.rotation.y = Math.sin(elapsedTime * 0.03) * 0.04;
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      disposeObject(scene);
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  if (webGlError) {
    return (
      <div className="flex h-full min-h-[420px] items-center justify-center bg-vp-surface text-center">
        <div>
          <Mountain className="mx-auto mb-3 text-vp-muted" />
          <p className="vp-label">3D journey unavailable</p>
          <p className="mt-2 text-xs text-vp-muted">WebGL is not available on this device.</p>
        </div>
      </div>
    );
  }

  return (
    <section className="relative min-h-[500px] h-full overflow-hidden rounded-lg border border-vp-border-strong bg-vp-surface shadow-[0_18px_48px_rgba(0,0,0,0.45)]">
      <div ref={mountRef} className="absolute inset-0" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(3,7,18,0.16),transparent_34%,rgba(3,7,18,0.76))]" />

      <div className="absolute left-4 right-4 top-4 flex items-start justify-between gap-4">
        <div className="rounded-md border border-white/10 bg-black/45 px-3 py-2 backdrop-blur-md">
          <div className="flex items-center gap-2 text-vp-accent">
            <Zap size={14} />
            <span className="text-[10px] font-bold uppercase tracking-[0.18em]">Midnight Tokyo Ride</span>
          </div>
          <div className="mt-1 text-[9px] font-mono uppercase tracking-[0.14em] text-white/55">
            Block {Math.floor(elapsed / 300) + 1} · Night session
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/45 px-3 py-1.5 backdrop-blur-md">
          <Radio size={11} className={visualState.hasBikeSignal ? 'text-vp-accent' : 'text-vp-muted'} />
          <span className="text-[9px] font-mono uppercase tracking-[0.14em] text-white/70">
            {visualState.hasBikeSignal ? 'Sensor linked' : 'Fallback pace'}
          </span>
        </div>
      </div>

      <div className="absolute left-4 top-[82px] flex items-center gap-2 rounded-md border border-white/10 bg-black/50 p-2 backdrop-blur-md">
        <Gauge size={13} className="text-vp-accent" />
        <label className="flex items-center gap-2">
          <span className="text-[9px] font-mono uppercase tracking-[0.12em] text-white/65">Visual speed</span>
          <input
            type="range"
            min="0.5"
            max="4"
            step="0.1"
            value={paceMultiplier}
            onChange={event => setPaceMultiplier(Number(event.target.value))}
            aria-label="Visual journey speed multiplier"
            className="vp-focus-ring w-24 accent-[var(--color-vp-accent)] sm:w-32"
          />
          <span className="min-w-8 text-right text-[10px] font-bold font-mono text-vp-accent">
            {paceMultiplier.toFixed(1)}x
          </span>
        </label>
      </div>

      <div className="absolute bottom-4 left-4 right-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <JourneyMetric icon={<Bike size={12} />} label="Cadence" value={telemetry.cadence || '--'} unit="RPM" />
        <JourneyMetric icon={<Zap size={12} />} label="Power" value={telemetry.power || '--'} unit="W" />
        <JourneyMetric icon={<Heart size={12} />} label={zoneLabel} value={telemetry.heartRate || '--'} unit="BPM" />
        <JourneyMetric icon={<Gauge size={12} />} label="City pace" value={adjustedVelocity.toFixed(1)} unit="M/S" />
      </div>
    </section>
  );
};

const JourneyMetric = ({
  icon,
  label,
  value,
  unit
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  unit: string;
}) => (
  <div className="rounded-md border border-white/10 bg-black/50 px-3 py-2 backdrop-blur-md">
    <div className="flex items-center gap-1.5 text-[8px] font-mono uppercase tracking-[0.14em] text-white/55">
      <span className="text-vp-accent">{icon}</span>
      {label}
    </div>
    <div className="mt-1 font-mono text-xl font-black tabular-nums text-white">
      {value}<span className="ml-1 text-[8px] font-normal text-white/50">{unit}</span>
    </div>
  </div>
);
