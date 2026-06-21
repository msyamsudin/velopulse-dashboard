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

const SKY_COLOR = 0x03060d;
const FOG_COLOR = 0x050b12;
const GROUND_COLOR = 0x05090b;
const ENVIRONMENT_ACCENT = 0x35f0bd;
const ACCENT_COLORS = [0x66828c, 0x35f0bd, 0xd9b83b, 0xe87935, 0xd94a5a];
const SEGMENT_COUNT = 24;
const SEGMENT_LENGTH = 18;
const FLIGHT_ALTITUDE = 10;

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
    materials.forEach(material => material?.dispose());
  });
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
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 520);
    camera.position.set(0, FLIGHT_ALTITUDE + 4.2, 9);
    camera.lookAt(0, FLIGHT_ALTITUDE + 1, -22);

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = false;
    mount.appendChild(renderer.domElement);

    const ambient = new THREE.HemisphereLight(0x54708f, 0x020405, 1.15);
    const moonLight = new THREE.DirectionalLight(0x9bb9df, 1.35);
    moonLight.position.set(-8, 14, 4);
    scene.add(ambient, moonLight);

    const roadMaterial = new THREE.MeshStandardMaterial({
      color: 0x061713,
      emissive: 0x061713,
      emissiveIntensity: 0.75,
      roughness: 0.65,
      transparent: true,
      opacity: 0.38,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x35f0bd });
    const groundMaterial = new THREE.MeshStandardMaterial({ color: GROUND_COLOR, roughness: 1 });
    const mountainMaterials = [0x091210, 0x0c1815, 0x10211c].map(color =>
      new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 1 })
    );

    const mountainWireframeMaterial = new THREE.LineBasicMaterial({
      color: 0x35f0bd,
      transparent: true,
      opacity: 0.18
    });
    const treeColorMaterial = new THREE.MeshStandardMaterial({ color: 0x08150f, roughness: 1, flatShading: true });
    const treeWireframeMaterial = new THREE.LineBasicMaterial({ color: 0x35f0bd, transparent: true, opacity: 0.28 });

    // Continuous edge line constants
    const EDGE_PTS = 165;
    const EDGE_STEP = 1.12; // metres between each edge sample point
    const ROAD_HALF_W = 3.45;
    const DASH_INTERVAL = 9;  // metres between dash starts
    const DASH_LEN = 3.5;     // metres length of each dash
    const DASH_LINES = 22;    // number of dashes to draw ahead

    const roadSegments: THREE.Group[] = [];
    for (let index = 0; index < SEGMENT_COUNT; index += 1) {
      const group = new THREE.Group();
      const road = new THREE.Mesh(new THREE.PlaneGeometry(7, SEGMENT_LENGTH + 0.25), roadMaterial);
      road.rotation.x = -Math.PI / 2;
      // No box edges — replaced by continuous edge lines below
      group.add(road);
      group.position.set(0, FLIGHT_ALTITUDE, -index * SEGMENT_LENGTH);
      scene.add(group);
      roadSegments.push(group);
    }

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(250, 580), groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -8, -230);
    scene.add(ground);

    // Continuous road edge lines — single polyline per side, no gaps
    const leftEdgeGeo = new THREE.BufferGeometry();
    const rightEdgeGeo = new THREE.BufferGeometry();
    const leftEdgePosArr = new Float32Array(EDGE_PTS * 3);
    const rightEdgePosArr = new Float32Array(EDGE_PTS * 3);
    leftEdgeGeo.setAttribute('position', new THREE.BufferAttribute(leftEdgePosArr, 3));
    rightEdgeGeo.setAttribute('position', new THREE.BufferAttribute(rightEdgePosArr, 3));
    const leftEdgeLine = new THREE.Line(leftEdgeGeo, edgeMaterial);
    const rightEdgeLine = new THREE.Line(rightEdgeGeo, edgeMaterial);
    scene.add(leftEdgeLine, rightEdgeLine);

    // Center dashes — continuous, aligned to road curve
    const centerDashGeo = new THREE.BufferGeometry();
    const centerDashPosArr = new Float32Array(DASH_LINES * 2 * 3);
    centerDashGeo.setAttribute('position', new THREE.BufferAttribute(centerDashPosArr, 3));
    const centerDashMaterial = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.14
    });
    const centerDashLine = new THREE.LineSegments(centerDashGeo, centerDashMaterial);
    scene.add(centerDashLine);

    const mountains: THREE.Mesh[] = [];
    const coneGeometry = new THREE.ConeGeometry(7, 15, 5);
    const mountainWireframeGeo = new THREE.WireframeGeometry(coneGeometry);
    for (let index = 0; index < 30; index += 1) {
      const mountain = new THREE.Mesh(coneGeometry, mountainMaterials[index % mountainMaterials.length]);
      const side = index % 2 === 0 ? -1 : 1;
      mountain.position.set(side * (12 + (index % 5) * 5), -5 + (index % 3), -12 - index * 15);
      mountain.scale.setScalar(0.7 + (index % 4) * 0.18);
      mountain.rotation.y = index * 1.7;

      const wireframe = new THREE.LineSegments(mountainWireframeGeo, mountainWireframeMaterial);
      mountain.add(wireframe);

      scene.add(mountain);
      mountains.push(mountain);
    }

    const moonGroup = new THREE.Group();
    const moonGeo = new THREE.CircleGeometry(14, 32);
    const moonMaterial = new THREE.MeshBasicMaterial({
      color: ENVIRONMENT_ACCENT,
      transparent: true,
      opacity: 0.8
    });
    const moonMesh = new THREE.Mesh(moonGeo, moonMaterial);
    moonGroup.add(moonMesh);

    const moonStripeMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
    for (let i = -12; i < 4; i += 3.2) {
      const stripeHeight = 0.5 + (4 - i) * 0.12;
      const stripe = new THREE.Mesh(new THREE.PlaneGeometry(30, stripeHeight), moonStripeMaterial);
      stripe.position.set(0, i, 0.05);
      moonGroup.add(stripe);
    }
    moonGroup.position.set(0, 35, -240);
    scene.add(moonGroup);

    const createLowPolyTree = (treeColorMat: THREE.Material, treeWireframeMat: THREE.Material) => {
      const group = new THREE.Group();
      
      const trunkGeo = new THREE.CylinderGeometry(0.12, 0.18, 1.2, 5);
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x080503, roughness: 1 });
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = 0.6;
      group.add(trunk);

      const leavesGroup = new THREE.Group();
      const coneGeo1 = new THREE.ConeGeometry(0.9, 1.6, 5);
      const coneGeo2 = new THREE.ConeGeometry(0.7, 1.3, 5);
      const coneGeo3 = new THREE.ConeGeometry(0.5, 1.0, 5);

      const leaf1 = new THREE.Mesh(coneGeo1, treeColorMat);
      leaf1.position.y = 1.8;
      const leaf2 = new THREE.Mesh(coneGeo2, treeColorMat);
      leaf2.position.y = 2.6;
      const leaf3 = new THREE.Mesh(coneGeo3, treeColorMat);
      leaf3.position.y = 3.2;

      const wf1 = new THREE.LineSegments(new THREE.WireframeGeometry(coneGeo1), treeWireframeMat);
      leaf1.add(wf1);
      const wf2 = new THREE.LineSegments(new THREE.WireframeGeometry(coneGeo2), treeWireframeMat);
      leaf2.add(wf2);
      const wf3 = new THREE.LineSegments(new THREE.WireframeGeometry(coneGeo3), treeWireframeMat);
      leaf3.add(wf3);

      leavesGroup.add(leaf1, leaf2, leaf3);
      group.add(leavesGroup);
      
      const scale = 0.85 + Math.random() * 0.45;
      group.scale.set(scale, scale, scale);

      return group;
    };

    const trees: THREE.Group[] = [];
    const treeCount = 16;
    for (let i = 0; i < treeCount; i++) {
      const tree = createLowPolyTree(treeColorMaterial, treeWireframeMaterial);
      const side = i % 2 === 0 ? -1 : 1;
      const zPos = -i * (180 / treeCount);
      tree.position.set(side * (5.5 + (i % 4) * 1.5), -7.9, zPos);
      scene.add(tree);
      trees.push(tree);
    }

    // Neon energy ring portal (replaces rectangular gate)
    const ringPortal = new THREE.Group();

    const ringPortalMaterial = new THREE.MeshBasicMaterial({
      color: ACCENT_COLORS[0],
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending
    });
    const ringInnerMaterial = new THREE.MeshBasicMaterial({
      color: ACCENT_COLORS[0],
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending
    });
    const ringSpokeMaterial = new THREE.LineBasicMaterial({
      color: ACCENT_COLORS[0],
      transparent: true,
      opacity: 0.22
    });
    const ringFaceMaterial = new THREE.MeshBasicMaterial({
      color: ACCENT_COLORS[0],
      transparent: true,
      opacity: 0.04,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending
    });

    const outerTorusGeo = new THREE.TorusGeometry(3.6, 0.07, 8, 52);
    const outerRingMesh = new THREE.Mesh(outerTorusGeo, ringPortalMaterial);
    ringPortal.add(outerRingMesh);

    const innerTorusGeo = new THREE.TorusGeometry(3.15, 0.038, 8, 52);
    const innerRingMesh = new THREE.Mesh(innerTorusGeo, ringInnerMaterial);
    ringPortal.add(innerRingMesh);

    const spokeGeo = new THREE.WireframeGeometry(new THREE.TorusGeometry(3.38, 0.035, 4, 14));
    const spokes = new THREE.LineSegments(spokeGeo, ringSpokeMaterial);
    ringPortal.add(spokes);

    const faceGeo = new THREE.CircleGeometry(3.5, 48);
    const faceMesh = new THREE.Mesh(faceGeo, ringFaceMaterial);
    ringPortal.add(faceMesh);

    ringPortal.position.set(0, FLIGHT_ALTITUDE + 2.5, -200);
    scene.add(ringPortal);

    // Third-person hovercraft. Its restrained movement keeps the scene readable
    // while still communicating speed, turns, effort and climb rate.
    const craft = new THREE.Group();
    const craftBodyMaterial = new THREE.MeshStandardMaterial({
      color: 0x18232c,
      metalness: 0.82,
      roughness: 0.24
    });
    const craftAccentMaterial = new THREE.MeshBasicMaterial({ color: ENVIRONMENT_ACCENT });
    const engineMaterial = new THREE.MeshBasicMaterial({
      color: ENVIRONMENT_ACCENT,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending
    });
    const fuselage = new THREE.Mesh(new THREE.ConeGeometry(0.48, 2.8, 8), craftBodyMaterial);
    fuselage.rotation.x = -Math.PI / 2;
    const cockpit = new THREE.Mesh(
      new THREE.SphereGeometry(0.38, 12, 8),
      new THREE.MeshStandardMaterial({ color: 0x183548, metalness: 0.45, roughness: 0.18 })
    );
    cockpit.scale.set(0.75, 0.48, 1.25);
    cockpit.position.set(0, 0.24, -0.25);
    const wing = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.08, 0.72), craftBodyMaterial);
    wing.position.z = 0.45;
    const leftTip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 1.2), craftAccentMaterial);
    const rightTip = leftTip.clone();
    leftTip.position.set(-1.5, 0, 0.3);
    rightTip.position.set(1.5, 0, 0.3);
    const engineGeometry = new THREE.SphereGeometry(0.2, 10, 6);
    const leftEngine = new THREE.Mesh(engineGeometry, engineMaterial);
    const rightEngine = leftEngine.clone();
    leftEngine.position.set(-0.62, -0.03, 1.25);
    rightEngine.position.set(0.62, -0.03, 1.25);
    craft.add(fuselage, cockpit, wing, leftTip, rightTip, leftEngine, rightEngine);
    craft.position.set(0, FLIGHT_ALTITUDE + 1.15, 3.2);
    scene.add(craft);

    const dustGeometry = new THREE.BufferGeometry();
    const dustPositions = new Float32Array(150 * 3);
    for (let index = 0; index < 150; index += 1) {
      dustPositions[index * 3] = (Math.random() - 0.5) * 35;
      dustPositions[index * 3 + 1] = FLIGHT_ALTITUDE - 4 + Math.random() * 12;
      dustPositions[index * 3 + 2] = -Math.random() * 170;
    }
    dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
    const dustMaterial = new THREE.PointsMaterial({ color: 0xb4d9cf, size: 0.055, transparent: true, opacity: 0.45 });
    const dust = new THREE.Points(dustGeometry, dustMaterial);
    scene.add(dust);

    const starGeometry = new THREE.BufferGeometry();
    const starPositions = new Float32Array(220 * 3);
    for (let index = 0; index < 220; index += 1) {
      starPositions[index * 3] = (Math.random() - 0.5) * 180;
      starPositions[index * 3 + 1] = Math.random() * 55 + 10;
      starPositions[index * 3 + 2] = -Math.random() * 260 + 30;
    }
    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starMaterial = new THREE.PointsMaterial({
      color: 0x9fb9d4,
      size: 0.16,
      transparent: true,
      opacity: 0.5,
      depthWrite: false
    });
    const stars = new THREE.Points(starGeometry, starMaterial);
    scene.add(stars);

    const cloudMaterial = new THREE.MeshBasicMaterial({
      color: 0x7893a8,
      transparent: true,
      opacity: 0.09,
      depthWrite: false
    });
    const cloudGeometry = new THREE.IcosahedronGeometry(1.8, 1);
    const clouds: THREE.Group[] = [];
    for (let index = 0; index < 18; index += 1) {
      const cloud = new THREE.Group();
      for (let puff = 0; puff < 4; puff += 1) {
        const mesh = new THREE.Mesh(cloudGeometry, cloudMaterial);
        mesh.position.set((puff - 1.5) * 1.7, Math.sin(puff * 1.8) * 0.45, (puff % 2) * 0.6);
        mesh.scale.set(1.2 + puff * 0.12, 0.45 + (puff % 2) * 0.12, 0.9);
        cloud.add(mesh);
      }
      const side = index % 2 === 0 ? -1 : 1;
      cloud.position.set(side * (9 + (index % 4) * 5), 1 + (index % 5) * 1.1, -index * 22);
      cloud.rotation.y = index * 0.7;
      scene.add(cloud);
      clouds.push(cloud);
    }

    const warpCount = 30;
    const warpGeometry = new THREE.BufferGeometry();
    const warpPositions = new Float32Array(warpCount * 2 * 3);
    const warpSpeeds = new Float32Array(warpCount);
    const warpLength = 3.5;

    for (let i = 0; i < warpCount; i++) {
      const x = (Math.random() - 0.5) * 24;
      const y = FLIGHT_ALTITUDE - 3 + Math.random() * 8;
      const z = -Math.random() * 160;

      warpPositions[i * 6] = x;
      warpPositions[i * 6 + 1] = y;
      warpPositions[i * 6 + 2] = z;

      warpPositions[i * 6 + 3] = x;
      warpPositions[i * 6 + 4] = y;
      warpPositions[i * 6 + 5] = z - warpLength;

      warpSpeeds[i] = 1.0 + Math.random() * 0.6;
    }

    warpGeometry.setAttribute('position', new THREE.BufferAttribute(warpPositions, 3));
    const warpMaterial = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0
    });
    const warpLines = new THREE.LineSegments(warpGeometry, warpMaterial);
    scene.add(warpLines);

    const sparkCount = 50;
    const sparkGeometry = new THREE.BufferGeometry();
    const sparkPositions = new Float32Array(sparkCount * 3);
    const sparkVelocities = new Float32Array(sparkCount * 3);
    let sparkActive = false;
    let sparkTime = 0;
    let checkpointFlash = 0;

    for (let i = 0; i < sparkCount; i++) {
      sparkPositions[i * 3] = 0;
      sparkPositions[i * 3 + 1] = -100;
      sparkPositions[i * 3 + 2] = 0;
    }
    sparkGeometry.setAttribute('position', new THREE.BufferAttribute(sparkPositions, 3));
    const sparkMaterial = new THREE.PointsMaterial({
      color: 0x35f0bd,
      size: 0.25,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending
    });
    const sparkPoints = new THREE.Points(sparkGeometry, sparkMaterial);
    scene.add(sparkPoints);

    const triggerCheckpoint = () => {
      checkpointFlash = 1.0;
      sparkActive = true;
      sparkTime = 0;
      sparkMaterial.opacity = 1.0;
      
      const posAttr = sparkGeometry.getAttribute('position') as THREE.BufferAttribute;
      const positions = posAttr.array as Float32Array;
      
      for (let i = 0; i < sparkCount; i++) {
        const isLeft = i % 2 === 0;
        const x = isLeft ? -3.5 : 3.5;
        const y = FLIGHT_ALTITUDE + Math.random() * 5.0;
        const z = 8.0;

        positions[i * 3] = x;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = z;

        sparkVelocities[i * 3] = (isLeft ? -1 : 1) * (1.5 + Math.random() * 6);
        sparkVelocities[i * 3 + 1] = (Math.random() - 0.2) * 5;
        sparkVelocities[i * 3 + 2] = (Math.random() - 0.5) * 4;
      }
      posAttr.needsUpdate = true;
    };

    const clock = new THREE.Clock();
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frame = 0;
    let elapsedTime = 0;
    let distance = 0;
    let smoothVelocity = 2.4;
    let smoothGrade = 0;
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
      const smoothing = 1 - Math.exp(-delta * 2.2);
      smoothVelocity = THREE.MathUtils.lerp(smoothVelocity, target.velocity, smoothing);
      smoothGrade = THREE.MathUtils.lerp(smoothGrade, target.grade, smoothing);
      const movement = smoothVelocity * delta * (reducedMotion ? 0.35 : 1);
      distance += movement;

      roadSegments.forEach((segment, index) => {
        segment.position.z += movement;
        if (segment.position.z > SEGMENT_LENGTH) segment.position.z -= SEGMENT_COUNT * SEGMENT_LENGTH;
        const worldDistance = distance - segment.position.z;
        segment.position.x = Math.sin(worldDistance * 0.013) * 1.35;
        segment.rotation.z = Math.sin(worldDistance * 0.013) * 0.04;
        segment.position.y = FLIGHT_ALTITUDE + Math.sin(worldDistance * 0.018) * 0.32 + smoothGrade * index * 0.035;
      });

      mountains.forEach(mountain => {
        mountain.position.z += movement * 0.72;
        if (mountain.position.z > 20) mountain.position.z -= 450;
      });

      clouds.forEach((cloud, index) => {
        cloud.position.z += movement * (0.35 + (index % 3) * 0.04);
        cloud.position.x += Math.sin(elapsedTime * 0.08 + index) * delta * 0.08;
        if (cloud.position.z > 25) cloud.position.z -= 400;
      });

      trees.forEach((tree, index) => {
        tree.position.z += movement;
        if (tree.position.z > 15) {
          tree.position.z -= 180;
        }
        const side = index % 2 === 0 ? -1 : 1;
        tree.position.x = side * (5.5 + (index % 4) * 1.5);
        tree.position.y = -7.9;
      });

      // Ring portal animation
      const prevPortalZ = ringPortal.position.z;
      ringPortal.position.z += movement;
      if (ringPortal.position.z > 12) ringPortal.position.z -= 240;
      const portalWorldDist = distance - ringPortal.position.z;
      ringPortal.position.x = Math.sin(portalWorldDist * 0.013) * 1.35;
      ringPortal.position.y = FLIGHT_ALTITUDE + 2.5 + Math.sin(portalWorldDist * 0.018) * 0.32 +
        smoothGrade * (Math.abs(ringPortal.position.z) / SEGMENT_LENGTH) * 0.035;
      // Slow spin — more dramatic when velocity is high
      ringPortal.rotation.z += delta * (0.35 + smoothVelocity * 0.006);

      if (prevPortalZ < 8 && ringPortal.position.z >= 8) {
        triggerCheckpoint();
      }

      // ── Continuous road edge lines ──────────────────────────────────────
      {
        const leftAttr = leftEdgeGeo.getAttribute('position') as THREE.BufferAttribute;
        const rightAttr = rightEdgeGeo.getAttribute('position') as THREE.BufferAttribute;
        const lArr = leftAttr.array as Float32Array;
        const rArr = rightAttr.array as Float32Array;

        for (let i = 0; i < EDGE_PTS; i++) {
          const s = i * EDGE_STEP;
          const w = distance - s;
          const cx = Math.sin(w * 0.013) * 1.35;
          const cy = FLIGHT_ALTITUDE + Math.sin(w * 0.018) * 0.32 + smoothGrade * (s / SEGMENT_LENGTH) * 0.035;
          const cz = 8 - s;

          // Right-facing unit normal perpendicular to road tangent in xz-plane
          // Tangent x-component: d(cx)/dw = cos(w*0.013)*0.013*1.35
          // Normal (rotated 90° CW in xz): N = (1, cos*0.013*1.35) / len
          const tDx = Math.cos(w * 0.013) * 0.013 * 1.35;
          const tLen = Math.sqrt(tDx * tDx + 1.0);
          const nX = 1.0 / tLen;
          const nZ = -tDx / tLen;

          lArr[i * 3]     = cx - nX * ROAD_HALF_W;
          lArr[i * 3 + 1] = cy + 0.04;
          lArr[i * 3 + 2] = cz - nZ * ROAD_HALF_W;

          rArr[i * 3]     = cx + nX * ROAD_HALF_W;
          rArr[i * 3 + 1] = cy + 0.04;
          rArr[i * 3 + 2] = cz + nZ * ROAD_HALF_W;
        }
        leftAttr.needsUpdate = true;
        rightAttr.needsUpdate = true;
      }

      // ── Center dashes ───────────────────────────────────────────────────
      {
        const dashAttr = centerDashGeo.getAttribute('position') as THREE.BufferAttribute;
        const dArr = dashAttr.array as Float32Array;
        const dashPhase = distance % DASH_INTERVAL;
        for (let i = 0; i < DASH_LINES; i++) {
          const s0 = i * DASH_INTERVAL + (DASH_INTERVAL - dashPhase);
          const s1 = s0 + DASH_LEN;
          for (let j = 0; j < 2; j++) {
            const s = j === 0 ? s0 : s1;
            const w = distance - s;
            const cx = Math.sin(w * 0.013) * 1.35;
            const cy = FLIGHT_ALTITUDE + Math.sin(w * 0.018) * 0.32 + smoothGrade * (s / SEGMENT_LENGTH) * 0.035;
            dArr[(i * 2 + j) * 3]     = cx;
            dArr[(i * 2 + j) * 3 + 1] = cy + 0.035;
            dArr[(i * 2 + j) * 3 + 2] = 8 - s;
          }
        }
        dashAttr.needsUpdate = true;
      }

      const bpm = latest.telemetry.heartRate || 70;
      const hrPeriod = 60 / bpm;
      const hrPulse = Math.pow(Math.sin((elapsedTime / hrPeriod) * Math.PI * 2) * 0.5 + 0.5, 4);

      const zone = target.hrZone < 0 ? 0 : target.hrZone;
      const sky = new THREE.Color(SKY_COLOR);
      const fog = new THREE.Color(FOG_COLOR);
      const groundColor = new THREE.Color(GROUND_COLOR);
      const accent = new THREE.Color(ACCENT_COLORS[zone]);
      const environmentAccent = new THREE.Color(ENVIRONMENT_ACCENT);
      const nightPulse = 0.92 + Math.sin(elapsedTime * 0.08) * 0.08;
      sky.multiplyScalar(nightPulse);
      fog.multiplyScalar(0.94 + Math.sin(elapsedTime * 0.065 + 1.4) * 0.06);
      groundColor.multiplyScalar(0.9 + Math.sin(elapsedTime * 0.055 + 2.2) * 0.1);
      scene.background = scene.background instanceof THREE.Color ? scene.background.lerp(sky, delta * 0.4) : sky;
      if (!scene.fog) scene.fog = new THREE.Fog(fog, 20, 165);
      scene.fog.color.lerp(fog, delta * 0.5);
      groundMaterial.color.lerp(groundColor, delta * 0.25);
      
      const pulsedAccent = environmentAccent.clone().multiplyScalar(0.76 + hrPulse * 0.24);
      edgeMaterial.color.lerp(pulsedAccent, delta * 1.8);
      roadMaterial.color.lerp(environmentAccent.clone().multiplyScalar(0.12), delta * 0.65);
      roadMaterial.emissive.lerp(environmentAccent.clone().multiplyScalar(0.2), delta * 0.8);
      roadMaterial.opacity = 0.28 + Math.min(target.intensity, 1) * 0.13;
      craftAccentMaterial.color.lerp(environmentAccent, delta * 2.4);
      engineMaterial.color.lerp(environmentAccent, delta * 3);
      // Ring portal material — color + HR pulse scale
      ringPortalMaterial.color.lerp(accent, delta * 1.8);
      ringInnerMaterial.color.lerp(accent, delta * 1.8);
      ringSpokeMaterial.color.lerp(accent, delta * 1.5);
      ringFaceMaterial.color.lerp(accent, delta * 1.5);
      ringPortalMaterial.opacity = 0.78 + hrPulse * 0.22;
      ringInnerMaterial.opacity = 0.30 + hrPulse * 0.20;
      const ringPulseScale = 1.0 + hrPulse * 0.055;
      ringPortal.scale.set(ringPulseScale, ringPulseScale, 1);

      mountainWireframeMaterial.color.lerp(environmentAccent, delta * 1.5);
      treeWireframeMaterial.color.lerp(environmentAccent, delta * 1.5);
      sparkMaterial.color.lerp(accent, delta * 2.5);
      centerDashMaterial.color.lerp(environmentAccent, delta * 0.5);

      const leafBaseColor = new THREE.Color(0x08150f);
      treeColorMaterial.color.lerp(leafBaseColor, delta * 0.4);

      moonMaterial.color.lerp(environmentAccent, delta * 1.5);
      moonMaterial.opacity = (0.55 + hrPulse * 0.35) * (0.85 + Math.sin(elapsedTime * 0.3) * 0.05);
      const moonPulseScale = 1.0 + hrPulse * 0.04;
      moonGroup.scale.set(moonPulseScale, moonPulseScale, 1);

      dustMaterial.color.lerp(accent, delta * 0.5);
      dustMaterial.opacity = 0.25 + Math.min(target.intensity, 1) * 0.35;
      starMaterial.opacity = 0.38 + Math.sin(elapsedTime * 0.22) * 0.12;
      cloudMaterial.color.lerp(new THREE.Color(0x7893a8), delta * 0.12);
      cloudMaterial.opacity = 0.065 + Math.sin(elapsedTime * 0.1) * 0.015;

      const warpPosAttr = warpGeometry.getAttribute('position') as THREE.BufferAttribute;
      const warpPositionsArr = warpPosAttr.array as Float32Array;
      const minWarpVel = 11;
      const maxWarpVel = 56;
      const warpFactor = THREE.MathUtils.clamp((smoothVelocity - minWarpVel) / (maxWarpVel - minWarpVel), 0, 1);
      
      warpMaterial.opacity = warpFactor * 0.5;
      warpMaterial.color.lerp(accent, delta * 0.8);

      for (let i = 0; i < warpCount; i++) {
        let zStart = warpPositionsArr[i * 6 + 2];
        zStart += movement * 1.9 * warpSpeeds[i];
        
        if (zStart > 10) {
          zStart = -160 - Math.random() * 40;
          const x = (Math.random() - 0.5) * 24;
          const y = FLIGHT_ALTITUDE - 3 + Math.random() * 8;
          
          warpPositionsArr[i * 6] = x;
          warpPositionsArr[i * 6 + 1] = y;
          warpPositionsArr[i * 6 + 3] = x;
          warpPositionsArr[i * 6 + 4] = y;
        }

        warpPositionsArr[i * 6 + 2] = zStart;
        warpPositionsArr[i * 6 + 5] = zStart - warpLength * (1 + warpFactor * 2.5);
      }
      warpPosAttr.needsUpdate = true;

      if (checkpointFlash > 0) {
        checkpointFlash = Math.max(0, checkpointFlash - delta * 2.4);
        ambient.intensity = 1.15 + checkpointFlash * 2.2;
        moonLight.intensity = 1.35 + checkpointFlash * 1.8;
      } else {
        ambient.intensity = 1.15;
        moonLight.intensity = 1.35;
      }

      if (sparkActive) {
        sparkTime += delta;
        const posAttr = sparkGeometry.getAttribute('position') as THREE.BufferAttribute;
        const positions = posAttr.array as Float32Array;

        for (let i = 0; i < sparkCount; i++) {
          positions[i * 3] += sparkVelocities[i * 3] * delta;
          positions[i * 3 + 1] += sparkVelocities[i * 3 + 1] * delta - 4.5 * delta;
          positions[i * 3 + 2] += sparkVelocities[i * 3 + 2] * delta;
        }
        posAttr.needsUpdate = true;
        
        sparkMaterial.opacity = Math.max(0, 1.0 - sparkTime * 1.0);
        if (sparkTime >= 1.0) {
          sparkActive = false;
        }
      }

      const curveIntensity = Math.cos(distance * 0.013);
      const targetRoll = -curveIntensity * 0.12;
      let currentRoll = THREE.MathUtils.lerp(camera.rotation.z, targetRoll, smoothing);

      let shakeX = 0;
      let shakeY = 0;
      let shakeZ = 0;
      const powerLimit = 240;
      if (latest.telemetry.power > powerLimit) {
        const powerExcess = latest.telemetry.power - powerLimit;
        const shakeIntensity = Math.min(1.0, powerExcess / 260) * 0.065;
        const shakeSpeed = 50;
        shakeX = (Math.sin(elapsedTime * shakeSpeed) * Math.cos(elapsedTime * shakeSpeed * 1.1)) * shakeIntensity;
        shakeY = (Math.cos(elapsedTime * shakeSpeed * 1.25) * Math.sin(elapsedTime * shakeSpeed * 0.95)) * shakeIntensity;
        shakeZ = (Math.sin(elapsedTime * shakeSpeed * 1.45)) * shakeIntensity * 0.45;

        currentRoll += (Math.sin(elapsedTime * 65) * 0.012) * Math.min(1.0, powerExcess / 260);
      }

      const flightBob = Math.sin(elapsedTime * (1.25 + target.intensity * 0.35)) * 0.08;
      const craftTargetX = Math.sin((distance + 7) * 0.013) * 0.85;
      const craftTargetY = FLIGHT_ALTITUDE + 1.15 + smoothGrade * 1.8 + flightBob;
      craft.position.x = THREE.MathUtils.lerp(craft.position.x, craftTargetX, smoothing * 1.4);
      craft.position.y = THREE.MathUtils.lerp(craft.position.y, craftTargetY, smoothing * 1.2);
      craft.rotation.z = THREE.MathUtils.lerp(craft.rotation.z, targetRoll * 2.8, smoothing * 1.5);
      craft.rotation.x = THREE.MathUtils.lerp(craft.rotation.x, -smoothGrade * 0.13 + flightBob * 0.08, smoothing);
      craft.rotation.y = THREE.MathUtils.lerp(craft.rotation.y, -targetRoll * 0.55, smoothing);
      const engineScale = 0.85 + Math.min(target.intensity, 1.35) * 0.55 + Math.sin(elapsedTime * 8) * 0.06;
      leftEngine.scale.set(1, 1, engineScale);
      rightEngine.scale.copy(leftEngine.scale);
      engineMaterial.opacity = 0.68 + Math.min(target.intensity, 1) * 0.25;

      camera.position.z = 9 + shakeZ;
      camera.position.x = THREE.MathUtils.lerp(camera.position.x, craft.position.x * 0.38, smoothing) + shakeX;
      camera.position.y = THREE.MathUtils.lerp(
        camera.position.y,
        FLIGHT_ALTITUDE + 4.2 + smoothGrade * 1.35 + flightBob * 0.3,
        smoothing
      ) + shakeY;

      camera.lookAt(
        Math.sin((distance + 28) * 0.013) * 1.1,
        FLIGHT_ALTITUDE + 1 + smoothGrade * 2.2,
        -24
      );
      camera.rotation.z = currentRoll;

      dust.rotation.y += delta * 0.01;
      stars.rotation.y = Math.sin(elapsedTime * 0.025) * 0.035;
      stars.position.x = Math.sin(elapsedTime * 0.04) * 1.5;

      frame += 1;
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
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(6,7,8,0.2),transparent_35%,rgba(6,7,8,0.72))]" />

      <div className="absolute left-4 right-4 top-4 flex items-start justify-between gap-4">
        <div className="rounded-md border border-white/10 bg-black/35 px-3 py-2 backdrop-blur-md">
          <div className="flex items-center gap-2 text-vp-accent">
            <Zap size={14} />
            <span className="text-[10px] font-bold uppercase tracking-[0.18em]">Midnight Skyway</span>
          </div>
          <div className="mt-1 text-[9px] font-mono uppercase tracking-[0.14em] text-white/55">
            Air gate {Math.floor(elapsed / 300) + 1} · Flight live
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/35 px-3 py-1.5 backdrop-blur-md">
          <Radio size={11} className={visualState.hasBikeSignal ? 'text-vp-accent' : 'text-vp-muted'} />
          <span className="text-[9px] font-mono uppercase tracking-[0.14em] text-white/70">
            {visualState.hasBikeSignal ? 'Sensor linked' : 'Fallback pace'}
          </span>
        </div>
      </div>

      <div className="absolute left-4 top-[82px] flex items-center gap-2 rounded-md border border-white/10 bg-black/45 p-2 backdrop-blur-md">
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
        <JourneyMetric icon={<Gauge size={12} />} label="Flight speed" value={adjustedVelocity.toFixed(1)} unit="M/S" />
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
  <div className="rounded-md border border-white/10 bg-black/45 px-3 py-2 backdrop-blur-md">
    <div className="flex items-center gap-1.5 text-[8px] font-mono uppercase tracking-[0.14em] text-white/55">
      <span className="text-vp-accent">{icon}</span>
      {label}
    </div>
    <div className="mt-1 font-mono text-xl font-black tabular-nums text-white">
      {value}<span className="ml-1 text-[8px] font-normal text-white/50">{unit}</span>
    </div>
  </div>
);
