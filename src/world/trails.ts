import * as T from "three";
import { DEFAULT_TRAIL, TRAIL_BY_ID } from "../../shared/trails";
export type TrailSettings = { quality: string; comfort: boolean };
const topology = [0, -1, 0, 1, 1, -1, 1, -1, 0, 1, 1, 1];
const CAPACITY = 72,
  PARTICLES = 64;
const vertex = `attribute vec4 tint; varying vec4 vTint; varying vec2 vUv;
void main(){vTint=tint;vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const fragment = `varying vec4 vTint; varying vec2 vUv;
void main(){float edge=1.-smoothstep(.3,1.,abs(vUv.y*2.-1.)); gl_FragColor=vec4(vTint.rgb,vTint.a*edge);
#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}`;
const particleVertex = `attribute vec4 tint;attribute float size;varying vec4 vTint;
void main(){vTint=tint;vec4 p=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*p;gl_PointSize=clamp(size*210./max(1.,-p.z),1.,22.);}`;
const particleFragment = `uniform float kind;varying vec4 vTint;
void main(){vec2 p=gl_PointCoord*2.-1.;float r=length(p);float a=1.-smoothstep(.12,1.,r);
if(kind==1.) {float cross=min(abs(p.x),abs(p.y));float diagonal=abs(abs(p.x)-abs(p.y))*.7;a=(1.-smoothstep(.04,.16,min(cross,diagonal)))*(1.-smoothstep(.6,1.,r));}
if(kind==2.) a=(1.-smoothstep(.05,.2,abs(p.x)))*(1.-abs(p.y));
if(kind==3.) a=(1.-smoothstep(.65,.85,abs(p.x)+abs(p.y)))*(.55+.45*step(0.,p.x));
if(kind==4.) a=(1.-smoothstep(.75,.95,r))*(.35+.65*smoothstep(.35,.65,r));
if(kind==5.) a=(1.-smoothstep(.1,.9,length(vec2(p.x*(1.2+p.y*.4),p.y))))*(1.-p.y*.25);
gl_FragColor=vec4(vTint.rgb,a*vTint.a);
#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}`;
type Node = { x: number; y: number; z: number; born: number; phase: number };
export function createTrail(scene: T.Scene, id = DEFAULT_TRAIL) {
  let definition = TRAIL_BY_ID.get(id) || TRAIL_BY_ID.get(DEFAULT_TRAIL)!;
  const positions = new Float32Array(CAPACITY * 2 * 6 * 3),
    tints = new Float32Array(CAPACITY * 2 * 6 * 4),
    uvs = new Float32Array(CAPACITY * 2 * 6 * 2);
  const geometry = new T.BufferGeometry();
  geometry.setAttribute(
    "position",
    new T.BufferAttribute(positions, 3).setUsage(T.DynamicDrawUsage),
  );
  geometry.setAttribute(
    "tint",
    new T.BufferAttribute(tints, 4).setUsage(T.DynamicDrawUsage),
  );
  geometry.setAttribute("uv", new T.BufferAttribute(uvs, 2));
  for (let n = 0; n < CAPACITY * 2; n++)
    uvs.set([0, 0, 0, 1, 1, 0, 1, 0, 0, 1, 1, 1], n * 12);
  const material = new T.ShaderMaterial({
    vertexShader: vertex,
    fragmentShader: fragment,
    transparent: true,
    depthWrite: false,
    side: T.DoubleSide,
  });
  const ribbon = new T.Mesh(geometry, material);
  ribbon.frustumCulled = false;
  scene.add(ribbon);
  const particlePositions = new Float32Array(PARTICLES * 3),
    particleTints = new Float32Array(PARTICLES * 4),
    sizes = new Float32Array(PARTICLES),
    life = new Float32Array(PARTICLES),
    velocities = new Float32Array(PARTICLES * 3);
  const pg = new T.BufferGeometry();
  pg.setAttribute(
    "position",
    new T.BufferAttribute(particlePositions, 3).setUsage(T.DynamicDrawUsage),
  );
  pg.setAttribute(
    "tint",
    new T.BufferAttribute(particleTints, 4).setUsage(T.DynamicDrawUsage),
  );
  pg.setAttribute(
    "size",
    new T.BufferAttribute(sizes, 1).setUsage(T.DynamicDrawUsage),
  );
  const pm = new T.ShaderMaterial({
    vertexShader: particleVertex,
    fragmentShader: particleFragment,
    uniforms: { kind: { value: 0 } },
    transparent: true,
    depthWrite: false,
  });
  const particles = new T.Points(pg, pm);
  particles.frustumCulled = false;
  scene.add(particles);
  const pool: Node[] = Array.from({ length: CAPACITY }, () => ({
    x: 0,
    y: 0,
    z: 0,
    born: 0,
    phase: 0,
  }));
  const nodes: Node[] = [];
  let cursor = 0,
    particleCursor = 0,
    carry = 0,
    pathDistance = 0,
    initialized = false,
    emissions = 0;
  const previous = new T.Vector3(),
    color = new T.Color(),
    colorA = new T.Color(),
    pointA = new T.Vector3(),
    pointB = new T.Vector3();
  const head: Node = { x: 0, y: 0, z: 0, born: 0, phase: 0 };
  function clear() {
    nodes.length = 0;
    life.fill(0);
    particleTints.fill(0);
    carry = 0;
    initialized = false;
    geometry.setDrawRange(0, 0);
    pg.attributes.tint.needsUpdate = true;
  }
  function colorAt(phase: number, lane = 0) {
    if (definition.rainbow)
      return color.setHSL((phase * 0.055) % 1, 0.85, 0.67);
    return color.setHex(definition.colors[lane % definition.colors.length]);
  }
  function add(
    x: number,
    y: number,
    z: number,
    born: number,
    phase: number,
    settings: TrailSettings,
  ) {
    const node = pool[cursor++ % CAPACITY];
    if (nodes.length === CAPACITY) nodes.shift();
    node.x = x;
    node.y = y;
    node.z = z;
    node.born = born;
    node.phase = phase;
    nodes.push(node);
    emissions++;
    if (settings.comfort || emissions % (settings.quality === "low" ? 4 : 2))
      return;
    const i = particleCursor++ % PARTICLES,
      seed = Math.sin(emissions * 12.9898) * 43758.5453,
      noise = seed - Math.floor(seed);
    const c = colorAt(phase, i),
      f = definition.family;
    particlePositions.set([x, y, z], i * 3);
    particleTints.set([c.r, c.g, c.b, 0.65], i * 4);
    life[i] = 0.65;
    sizes[i] = f === "gem" || f === "coin" ? 0.22 : f === "snow" ? 0.19 : 0.11;
    velocities.set(
      [
        Math.sin(phase * 7) * 0.6,
        f === "snow" ? -0.7 : f === "fire" ? 1.4 : f === "storm" ? 0.6 : 0.3,
        Math.cos(phase * 7) * 0.6,
      ],
      i * 3,
    );
    sizes[i] *= 0.7 + noise * 0.6;
  }
  function offset(
    node: Node,
    lane: number,
    nx: number,
    nz: number,
    out: T.Vector3,
  ) {
    const f = definition.family,
      ph = node.phase;
    let sideways = 0,
      up = 0;
    if (f === "dual" || (f === "speed" && definition.colors.length > 1)) {
      sideways = Math.sin(ph * 2 + lane * Math.PI) * 0.27;
      up = Math.cos(ph * 2 + lane * Math.PI) * 0.22;
    }
    if (f === "storm") {
      sideways = Math.sin(ph * 4 + lane * Math.PI) * 0.32;
      up = Math.cos(ph * 4) * 0.28;
    }
    if (f === "soul") {
      sideways = Math.sin(ph * 1.8) * 0.15;
      up = Math.sin(ph * 2) * 0.2;
    }
    if (f === "lightning" || f === "hyperblast") {
      sideways = Math.sin(Math.floor(ph * 8 + lane * 2.1) * 19.7) * 0.22;
      up = Math.sin(Math.floor(ph * 8 + lane * 3.2) * 11.3) * 0.14;
    }
    if (f === "fire") {
      sideways = Math.sin(ph * 5) * 0.12;
      up = Math.sin(ph * 8) * 0.14 + (lane === 1 ? 0.16 : 0);
    }
    return out.set(node.x + nx * sideways, node.y + up, node.z + nz * sideways);
  }
  return {
    clear,
    get id() {
      return definition.id;
    },
    get stats() {
      return {
        segments: nodes.length,
        particles: life.filter((v) => v > 0).length,
        emissions,
      };
    },
    setTrail(next: string) {
      if (next !== definition.id) {
        definition = TRAIL_BY_ID.get(next) || TRAIL_BY_ID.get(DEFAULT_TRAIL)!;
        clear();
      }
    },
    update(
      position: T.Vector3,
      t: number,
      dt: number,
      settings: TrailSettings,
      enabled = true,
    ) {
      ribbon.visible = particles.visible = enabled;
      if (!enabled) {
        clear();
        return;
      }
      const f = definition.family,
        lifetime = settings.comfort ? 0.32 : f === "soul" ? 0.8 : 0.75;
      if (!initialized) {
        previous.copy(position);
        initialized = true;
      }
      const distance = previous.distanceTo(position);
      if (distance > Math.max(8, dt * 45)) {
        clear();
        previous.copy(position);
        initialized = true;
      } else if (distance > 0.001) {
        const spacing = settings.quality === "low" ? 0.3 : 0.16;
        if (!nodes.length)
          add(
            previous.x,
            previous.y + 1.15,
            previous.z,
            t - dt,
            pathDistance,
            settings,
          );
        for (
          let traveled = spacing - carry;
          traveled <= distance;
          traveled += spacing
        ) {
          const a = traveled / distance;
          add(
            T.MathUtils.lerp(previous.x, position.x, a),
            T.MathUtils.lerp(previous.y, position.y, a) + 1.15,
            T.MathUtils.lerp(previous.z, position.z, a),
            t - dt * (1 - a),
            pathDistance + traveled,
            settings,
          );
        }
        carry = (carry + distance) % spacing;
        pathDistance += distance;
        head.x = position.x;
        head.y = position.y + 1.15;
        head.z = position.z;
        head.born = t;
        head.phase = pathDistance;
      }
      previous.copy(position);
      while (nodes.length && t - nodes[0].born > lifetime) nodes.shift();
      let vertexCount = 0;
      const lanes =
        f === "dual" ||
        f === "storm" ||
        f === "fire" ||
        f === "hyperblast" ||
        (f === "speed" && definition.colors.length > 1)
          ? 2
          : 1;
      const count = nodes.length;
      for (let n = 1; n <= count; n++) {
        const a = nodes[n - 1],
          b = n < count ? nodes[n] : head;
        if (b.born < a.born || Math.hypot(b.x - a.x, b.z - a.z) < 0.001)
          continue;
        const dx = b.x - a.x,
          dz = b.z - a.z,
          length = Math.hypot(dx, dz) || 1,
          nx = -dz / length,
          nz = dx / length;
        for (let lane = 0; lane < lanes; lane++) {
          const aa = offset(a, lane, nx, nz, pointA),
            bb = offset(b, lane, nx, nz, pointB);
          const aw = Math.max(0, 1 - (t - a.born) / lifetime),
            bw = Math.max(0, 1 - (t - b.born) / lifetime);
          const width =
            (f === "speed"
              ? 0.12
              : f === "soul"
                ? 0.34
                : f === "fire"
                  ? 0.3
                  : f === "lightning"
                    ? 0.095
                    : 0.3) * (settings.comfort ? 0.6 : 1);
          const ca = colorA.copy(colorAt(a.phase + t * 0.5, lane)),
            cb = colorAt(b.phase + t * 0.5, lane);
          for (let vertex = 0; vertex < 6; vertex++) {
            const end = topology[vertex * 2],
              side = topology[vertex * 2 + 1];
            const pos = end ? bb : aa,
              fade = end ? bw : aw,
              c = end ? cb : ca;
            const vi = vertexCount * 3,
              ci = vertexCount * 4;
            positions[vi] = pos.x + nx * side * width * fade;
            positions[vi + 1] = pos.y + side * width * 0.7 * fade;
            positions[vi + 2] = pos.z + nz * side * width * fade;
            tints[ci] = c.r;
            tints[ci + 1] = c.g;
            tints[ci + 2] = c.b;
            tints[ci + 3] = fade * (settings.comfort ? 0.32 : 0.85);
            vertexCount++;
          }
        }
      }
      geometry.setDrawRange(0, vertexCount);
      geometry.attributes.position.needsUpdate = true;
      geometry.attributes.tint.needsUpdate = true;
      pm.uniforms.kind.value =
        f === "snow"
          ? 1
          : f === "sparks" ||
              f === "speed" ||
              f === "lightning" ||
              f === "hyperblast"
            ? 2
            : f === "gem"
              ? 3
              : f === "coin"
                ? 4
                : f === "fire"
                  ? 5
                  : 0;
      for (let i = 0; i < PARTICLES; i++) {
        if (life[i] <= 0) continue;
        life[i] = Math.max(0, life[i] - dt);
        for (let axis = 0; axis < 3; axis++)
          particlePositions[i * 3 + axis] += velocities[i * 3 + axis] * dt;
        particleTints[i * 4 + 3] = (life[i] / 0.65) * 0.65;
      }
      pg.attributes.position.needsUpdate =
        pg.attributes.tint.needsUpdate =
        pg.attributes.size.needsUpdate =
          true;
    },
    dispose() {
      ribbon.removeFromParent();
      particles.removeFromParent();
      geometry.dispose();
      material.dispose();
      pg.dispose();
      pm.dispose();
      clear();
    },
  };
}
