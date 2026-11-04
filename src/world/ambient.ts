import * as T from "three";
/** One GPU particle draw for fountain spray, fireflies and drifting petals. */
export function createAmbient(scene: T.Scene) {
  const geometry = new T.BufferGeometry(),
    positions = [],
    seeds = [];
  for (let i = 0; i < 192; i++) {
    const fountain = i < 40;
    positions.push(
      fountain ? -21 : -210 + Math.sin(i * 2.399) * 70,
      fountain ? 1.2 : 1 + (i % 9) * 0.35,
      fountain ? -18 : 170 + Math.cos(i * 2.399) * 70,
    );
    seeds.push(i * 0.618);
  }
  geometry.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("seed", new T.Float32BufferAttribute(seeds, 1));
  const material = new T.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { time: { value: 0 }, night: { value: 0 } },
    vertexShader: `attribute float seed; uniform float time; varying float kind; void main(){vec3 p=position; kind=step(24.0,seed); float phase=fract(time*.42+seed); if(kind<.5){p.x+=sin(seed*5.0)*phase*3.1;p.z+=cos(seed*5.0)*phase*3.1;p.y+=sin(phase*3.14159)*3.0;} else {p.x+=sin(time*.3+seed)*1.5;p.y+=sin(time+seed)*.35;} vec4 mv=modelViewMatrix*vec4(p,1.0); gl_Position=projectionMatrix*mv; gl_PointSize=clamp(75.0/-mv.z,1.0,4.0);}`,
    fragmentShader: `uniform float night; varying float kind; void main(){float r=length(gl_PointCoord-.5);if(r>.5)discard;vec3 col=mix(vec3(.5,.93,1.0),vec3(1.0,.78,.4),kind);gl_FragColor=vec4(col,(1.0-r*2.0)*(.6+night*.3));}`,
  });
  const points = new T.Points(geometry, material);
  points.frustumCulled = false;
  scene.add(points);
  const wingGeometry = new T.PlaneGeometry(0.45, 0.22, 2, 1);
  const wingTime = { value: 0 };
  const wingMaterial = new T.MeshBasicMaterial({
    color: 0xffcf6d,
    side: T.DoubleSide,
  });
  wingMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.wingTime = wingTime;
    shader.vertexShader = "uniform float wingTime;\n" + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>\ntransformed.z += abs(position.x)*sin(wingTime*9.0+instanceMatrix[3].x)*1.6; transformed.y += sin(wingTime+instanceMatrix[3].z)*.25;",
    );
  };
  const butterflies = new T.InstancedMesh(wingGeometry, wingMaterial, 10),
    transform = new T.Object3D();
  for (let i = 0; i < 10; i++) {
    transform.position.set(
      -210 + Math.sin(i * 2.4) * 50,
      2.5,
      170 + Math.cos(i * 2.4) * 50,
    );
    transform.updateMatrix();
    butterflies.setMatrixAt(i, transform.matrix);
  }
  butterflies.computeBoundingSphere();
  scene.add(butterflies);
  const energyGeometry = new T.BoxGeometry(0.16, 0.035, 7),
    energyMaterial = new T.MeshStandardMaterial({
      color: 0x28d9e4,
      emissive: 0x50e6ff,
      emissiveIntensity: 0.8,
      roughness: 0.8,
    });
  energyMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.energyTime = wingTime;
    shader.vertexShader = "varying float stripe;\n" + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>\nstripe=instanceMatrix[3].z;",
    );
    shader.fragmentShader =
      "uniform float energyTime; varying float stripe;\n" +
      shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <emissivemap_fragment>",
      "#include <emissivemap_fragment>\ntotalEmissiveRadiance *= .7+.3*sin(energyTime*3.0+stripe*.1);",
    );
  };
  const energy = new T.InstancedMesh(energyGeometry, energyMaterial, 58);
  let index = 0;
  for (let z = -360; z < -70; z += 10)
    for (const x of [182.4, 197.6]) {
      transform.position.set(x, 0.28, z);
      transform.updateMatrix();
      energy.setMatrixAt(index++, transform.matrix);
    }
  energy.computeBoundingSphere();
  scene.add(energy);
  let reduced = false;
  return {
    configure(q: string, comfort: boolean) {
      reduced = comfort;
      butterflies.visible = !comfort && q !== "low";
      geometry.setDrawRange(0, q === "low" ? 40 : q === "medium" ? 100 : 192);
      points.visible = !comfort;
    },
    update(t: number, x: number, z: number, n: number) {
      material.uniforms.time.value = t;
      wingTime.value = t;
      material.uniforms.night.value = n;
      points.visible =
        !reduced &&
        (Math.hypot(x + 21, z + 18) < 180 ||
          Math.hypot(x + 210, z - 170) < 220);
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      points.removeFromParent();
      energy.dispose();
      energyGeometry.dispose();
      energyMaterial.dispose();
      energy.removeFromParent();
      butterflies.dispose();
      wingGeometry.dispose();
      wingMaterial.dispose();
      butterflies.removeFromParent();
    },
  };
}
