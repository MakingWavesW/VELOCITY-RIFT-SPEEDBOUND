import * as T from "three";
import { type Batch, sphere, cylinder } from "./models";

/**
 * Sunburst Plaza visual treatment based on the approved reference image:
 * rich green ground, cyan-lit streets, a golden Solar Hoop landmark, low-poly
 * horizon hills and saturated gardens. Visual only: no collision, XP, pickups,
 * room messages, spawn positions or movement rules are touched.
 */
export function addSunburstReference(scene: T.Scene, batch: Batch) {
  // Continuous cyan edging follows the SAME four original east/west and
  // north/south avenues. Offsets live on the white shoulder, not in the lane.
  // Instanced by Batch rather than a mesh and material per segment.
  for (const roadX of [-330, 0, 190, 330]) {
    for (const side of [-1, 1]) {
      batch.box(0x57e6ed, roadX + side * 8.25, 0.25, 0, 0.19, 0.055, 866, true);
    }
  }
  for (const roadZ of [-330, 0, 170, 330]) {
    for (const side of [-1, 1]) {
      batch.box(0x57e6ed, 0, 0.25, roadZ + side * 8.25, 866, 0.055, 0.19, true);
    }
  }

  // The original solid planter footprints remain authoritative. Bright
  // ornamental shrubs sit INSIDE their already-blocked volumes.
  for (const px of [-27, 27]) {
    for (const pz of [-29, 29]) {
      for (const offset of [-2.5, 0, 2.5]) {
        batch.add(sphere, 0x33be77, px + offset, 0.95, pz - 1.5, 1.25, 0.72, 1.25);
        batch.add(sphere, 0x68df8d, px + offset, 1.24, pz + 1.2, 0.96, 0.87, 0.96);
      }
      // Golden flower accents complement the reference's warm yellow paths.
      for (const side of [-1, 1])
        batch.add(cylinder, 0xffdb67, px + side * 3.3, 0.69, pz + 3, 0.3, 0.12, 0.3, true);
    }
  }

  const root = new T.Group();
  root.name = "Sunburst Reference Art — visual only";
  scene.add(root);

  // The reference shows a gold gate framing a vivid city boulevard. Here it
  // surrounds the REAL Solar Hoop at (0,8,-68); the authoritative hit radius
  // and crossing plane remain entirely unchanged.
  const portal = new T.Group();
  portal.name = "Sunburst Golden Solar Hoop Frame (non-interactive)";
  portal.position.set(0, 8, -68);
  root.add(portal);

  const gateGold = new T.MeshStandardMaterial({
    color: 0xffc652,
    emissive: 0xe88d21,
    emissiveIntensity: 1.12,
    roughness: 0.3,
    metalness: 0.2,
  });
  const gateGeometry = new T.TorusGeometry(7.85, 0.38, 10, 72);
  const gate = new T.Mesh(gateGeometry, gateGold);
  gate.name = "Golden Solar Arch";
  portal.add(gate);

  const auraMaterial = new T.MeshBasicMaterial({
    color: 0x76fff0,
    transparent: true,
    opacity: 0.56,
    blending: T.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const auraGeometry = new T.TorusGeometry(8.35, 0.11, 6, 72);
  const aquaHalo = new T.Mesh(auraGeometry, auraMaterial);
  aquaHalo.position.z = -0.18;
  portal.add(aquaHalo);

  const rayGeometry = new T.BoxGeometry(0.23, 0.85, 0.15);
  const rayMaterial = new T.MeshBasicMaterial({ color: 0xffe492, toneMapped: false });
  const rays = new T.InstancedMesh(rayGeometry, rayMaterial, 16);
  const transform = new T.Object3D();
  for (let i = 0; i < 16; i++) {
    const angle = (i * Math.PI * 2) / 16;
    transform.position.set(Math.cos(angle) * 9.0, Math.sin(angle) * 9.0, -0.15);
    transform.rotation.set(0, 0, angle - Math.PI / 2);
    transform.scale.set(1, i % 2 ? 0.85 : 1.3, 1);
    transform.updateMatrix();
    rays.setMatrixAt(i, transform.matrix);
  }
  rays.instanceMatrix.needsUpdate = true;
  rays.computeBoundingSphere();
  portal.add(rays);

  // Curved illuminated roundabout markings: no new road physics or physical
  // obstacles, and kept outside the central starting circle.
  const loopGoldMaterial = new T.MeshBasicMaterial({
    color: 0xffe0a1, side: T.DoubleSide, toneMapped: false,
  });
  const loopGoldGeometry = new T.RingGeometry(32.0, 32.35, 96);
  const loopGold = new T.Mesh(loopGoldGeometry, loopGoldMaterial);
  loopGold.rotation.x = -Math.PI / 2;
  loopGold.position.y = 0.35;
  loopGold.name = "Sunburst Warm Plaza Ring";
  root.add(loopGold);

  const loopCyanMaterial = new T.MeshBasicMaterial({
    color: 0x66f4ed, side: T.DoubleSide, toneMapped: false,
  });
  const loopCyanGeometry = new T.RingGeometry(33.35, 33.52, 96);
  const loopCyan = new T.Mesh(loopCyanGeometry, loopCyanMaterial);
  loopCyan.rotation.x = -Math.PI / 2;
  loopCyan.position.y = 0.355;
  loopCyan.name = "Sunburst Cyan Plaza Ring";
  root.add(loopCyan);

  // Pastel, faceted hills are placed beyond the 440-unit playable boundary.
  // No extra terrain/collision changes, no GLB downloads and only one draw call.
  const hillsGeometry = new T.IcosahedronGeometry(1, 1);
  const hillsMaterial = new T.MeshLambertMaterial({ color: 0xffffff, flatShading: true });
  const hills = new T.InstancedMesh(hillsGeometry, hillsMaterial, 7);
  const colors = [0x69b8a0, 0x80cda2, 0x59b7a4, 0x8ccf99, 0x78bead, 0x6bc39a, 0x90cfb0];
  for (let i = 0; i < 7; i++) {
    const x = [-630, -470, -285, -100, 240, 460, 660][i];
    const z = -545 + (i % 3) * 28;
    const width = 95 + (i % 3) * 32;
    const height = 62 + (i % 4) * 15;
    transform.position.set(x, -41, z);
    transform.rotation.set(0, (i % 3) * 0.45, 0);
    transform.scale.set(width, height, width * 0.7);
    transform.updateMatrix();
    hills.setMatrixAt(i, transform.matrix);
    hills.setColorAt(i, new T.Color(colors[i]));
  }
  hills.computeBoundingSphere();
  hills.name = "Reference Low-Poly Skyline Hills";
  hills.castShadow = false;
  hills.receiveShadow = false;
  root.add(hills);

  return {
    get portal() { return portal; },
    update(time: number, comfort: boolean, night: number) {
      const phase = comfort ? 0 : time;
      aquaHalo.rotation.z = phase * 0.08;
      rays.rotation.z = comfort ? 0 : Math.sin(time * 0.32) * 0.07;
      auraMaterial.opacity = 0.50 + night * 0.24 +
        (comfort ? 0 : Math.sin(phase * 1.5) * 0.05);
      gateGold.emissiveIntensity = 1.06 + night * 0.25 +
        (comfort ? 0 : Math.sin(phase * 1.2) * 0.1);
    },
    dispose() {
      root.removeFromParent();
      for (const geometry of [
        gateGeometry, auraGeometry, rayGeometry,
        loopGoldGeometry, loopCyanGeometry, hillsGeometry,
      ]) geometry.dispose();
      for (const material of [
        gateGold, auraMaterial, rayMaterial, loopGoldMaterial,
        loopCyanMaterial, hillsMaterial,
      ]) material.dispose();
    },
  };
}
