// 这个文件就是原来的 main.js（Three.js 部分），几乎原样搬过来，
// 只是包进了一个函数 createScene(container)：
//   - 画布挂到 React 交给我们的 container 上，而不是 document.querySelector('#app')
//   - 不再自己监听 slider，改成对外提供 rotateTo() 和 setNight()，由 React 来调用
//   - 多了一个 dispose()，React 卸载组件时用它把所有东西清理干净
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import gsap from 'gsap';

export function createScene(container) {
  // ==================== 渲染器 ====================
  // alpha: true → 画布背景透明，页面背景由 CSS 决定（不再是蓝天）
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true; // 打开阴影：遮阳棚会在墙上投影
  renderer.shadowMap.type = THREE.PCFShadowMap;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();

  // ==================== 环境贴图 ====================
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTexture = pmrem.fromScene(new RoomEnvironment()).texture;
  scene.environment = envTexture;
  pmrem.dispose();
  scene.environmentIntensity = 0.5;

  // ==================== 楼的尺寸 ====================
  const W = 2.4; // 宽（正面、背面）
  const H = 3.5; // 高
  const D = 1.8; // 深（左面、右面）

  // ==================== 相机 ====================
  const camera = new THREE.PerspectiveCamera(50, 1, 1, 1000);
  camera.position.set(0, H / 2, 7.5);
  camera.lookAt(0, H / 2, 0);

  // 画布不再是整个窗口那么大，而是跟着 container 的大小走
  // ResizeObserver 会在 container 尺寸变化时通知我们
  const resize = () => {
    const { clientWidth: w, clientHeight: h } = container;
    if (!w || !h) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);
  resize();

  // ==================== 灯光：暖色 ====================
  const DAY = {
    key: 2.2,
    rim: 2,
    rimColor: new THREE.Color(0xffa860),
    env: 0.5,
  };
  const NIGHT = {
    key: 0.12,
    rim: 0.9,
    rimColor: new THREE.Color(0x8fa8ff), // 夜里的轮廓光换成冷一点的月光
    env: 0.1,
  };

  const keyLight = new THREE.DirectionalLight(0xffd6a8, DAY.key);
  keyLight.position.set(0, 10, 10);
  keyLight.target.position.set(0, H / 2, 0);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.camera.left = -3;
  keyLight.shadow.camera.right = 3;
  keyLight.shadow.camera.top = 3;
  keyLight.shadow.camera.bottom = -3;
  keyLight.shadow.bias = -0.0005;
  keyLight.shadow.normalBias = 0.02;

  const rimLight = new THREE.DirectionalLight(DAY.rimColor.clone(), DAY.rim);
  rimLight.position.set(-5, 3, -8);

  scene.add(keyLight, keyLight.target, rimLight);

  // ==================== 毛毡材质 ====================
  const makeNoiseTexture = () => {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const image = ctx.createImageData(size, size);
    for (let i = 0; i < image.data.length; i += 4) {
      const v = Math.random() * 255;
      image.data[i] = v;
      image.data[i + 1] = v;
      image.data[i + 2] = v;
      image.data[i + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2, 2);
    return texture;
  };
  const noiseTexture = makeNoiseTexture();

  const felt = (color) =>
    new THREE.MeshPhysicalMaterial({
      color,
      roughness: 1,
      bumpMap: noiseTexture,
      bumpScale: 3,
      sheen: 0.6,
      sheenRoughness: 0.8,
      sheenColor: new THREE.Color(0xfff3e0),
    });

  const COLORS = {
    wall: 0xbcab95,
    pane: 0xe2d5bd,
    white: 0xefefea,
    blue: 0x9cc7dc,
    yellow: 0xe6dc8a,
    olive: 0x4a5230,
    red: 0xd9472b,
    awningBlue: 0x2a8fc4,
    recess: 0xb3a592,
    brown: 0x4f3b2f,
    grey: 0x8a8987,
    teal: 0x1f85ad,
    pine: 0x1f3a2c,
    balcony: 0x8ec5d2,
  };

  // ==================== 内透：会发光的"玻璃" ====================
  // 每块玻璃都记下来，晚上让它们发出暖色的光。
  // 每块玻璃随机决定晚上亮不亮、亮多少，看起来更像有人住。
  const panes = [];
  const WINDOW_LIGHT = 0xffbe6b;
  const glass = () => {
    const material = felt(COLORS.pane);
    material.emissive = new THREE.Color(WINDOW_LIGHT);
    material.emissiveIntensity = 0;
    const lit = Math.random() < 0.75 ? 0.6 + Math.random() * 0.7 : 0.02;
    panes.push({ material, lit });
    return material;
  };

  const metal = new THREE.MeshStandardMaterial({
    color: 0xd0d0d0,
    metalness: 1,
    roughness: 0.25,
  });

  const box = (w, h, d, material, x = 0, y = 0, z = 0) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  };

  // ==================== 楼体 ====================
  const building = new THREE.Group();
  scene.add(building);

  const DOOR_L = -0.24;
  const DOOR_R = 0.36;
  const DOOR_H = 0.82;

  const outline = new THREE.Shape();
  outline.moveTo(-W / 2, 0);
  outline.lineTo(DOOR_L, 0);
  outline.lineTo(DOOR_L, DOOR_H);
  outline.lineTo(DOOR_R, DOOR_H);
  outline.lineTo(DOOR_R, 0);
  outline.lineTo(W / 2, 0);
  outline.lineTo(W / 2, H);
  outline.lineTo(-W / 2, H);
  outline.closePath();

  const bodyGeometry = new THREE.ExtrudeGeometry(outline, { depth: D, bevelEnabled: false });
  bodyGeometry.translate(0, 0, -D / 2);
  const body = new THREE.Mesh(bodyGeometry, felt(COLORS.wall));
  body.castShadow = true;
  body.receiveShadow = true;
  building.add(body);

  // 门洞只往里凹一点，后半段用一块墙堵上
  const DOOR_DEPTH = 0.3;
  building.add(
    box(
      DOOR_R - DOOR_L - 0.002,
      DOOR_H,
      D - DOOR_DEPTH,
      felt(COLORS.wall),
      (DOOR_L + DOOR_R) / 2,
      DOOR_H / 2,
      -DOOR_DEPTH / 2
    )
  );

  // ==================== 四个面 ====================
  const makeFace = (x, z, rotationY) => {
    const face = new THREE.Group();
    face.position.set(x, 0, z);
    face.rotation.y = rotationY;
    building.add(face);
    return face;
  };

  const faces = {
    front: makeFace(0, D / 2, 0),
    back: makeFace(0, -D / 2, Math.PI),
    right: makeFace(W / 2, 0, Math.PI / 2),
    left: makeFace(-W / 2, 0, -Math.PI / 2),
  };

  // ==================== 窗户 ====================
  // let windowCount = 0;
  const makeWindow = ({
    face = faces.front,
    x,
    y,
    frame,
    cols = 1,
    rows = 2,
    vSplits,
    hSplits,
    w = 0.72,
    h = 0.4,
    t = 0.06,
    bar = t * 0.8,
  }) => {
    const group = new THREE.Group();
    group.position.set(x, y, 0);

    const d = 0.03;
    const frameMat = felt(frame);

    group.add(box(w, h, 0.01, glass(), 0, 0, 0.005)); // 玻璃（晚上会亮）

    group.add(box(w, t, d, frameMat, 0, h / 2 - t / 2, d / 2));
    group.add(box(w, t, d, frameMat, 0, -h / 2 + t / 2, d / 2));
    group.add(box(t, h, d, frameMat, -w / 2 + t / 2, 0, d / 2));
    group.add(box(t, h, d, frameMat, w / 2 - t / 2, 0, d / 2));

    const vs = vSplits ?? Array.from({ length: cols - 1 }, (_, i) => (i + 1) / cols);
    const hs = hSplits ?? Array.from({ length: rows - 1 }, (_, j) => (j + 1) / rows);
    vs.forEach((f) => group.add(box(bar, h, d, frameMat, -w / 2 + f * w, 0, d / 2)));
    hs.forEach((f) => group.add(box(w, bar, d, frameMat, 0, -h / 2 + f * h, d / 2)));

    face.add(group);
    // windowCount++;
  };

  const makeBlank = ({ face, x, y, w, h }) => {
    face.add(box(w, h, 0.012, glass(), x, y, 0.006));
  };

  // ==================== 遮阳棚 ====================
  const awnings = [];
  const AWNING_TILT = -0.5;

  const makeAwning = ({ face = faces.front, x, y, color, w = 0.8, h = 0.26, wire = false, band }) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);

    pivot.add(box(w, h, 0.025, felt(color), 0, -h / 2, 0.0125));

    if (band) {
      const bandH = h * 0.35;
      pivot.add(box(w, bandH, 0.01, felt(band), 0, -bandH / 2, 0.031));
    }

    if (wire) {
      const wireMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, w * 0.85, 8), metal);
      wireMesh.rotation.z = Math.PI / 2;
      wireMesh.position.set(0, -0.04, 0.03);
      pivot.add(wireMesh);
    }

    pivot.rotation.x = AWNING_TILT;
    awnings.push(pivot);
    face.add(pivot);
  };

  // ==================== 红窗里的树 ====================
  const makeTree = ({ face, x, y, w, h, tiers = 5 }) => {
    const shape = new THREE.Shape();
    const tip = (i) => (w / 2) * (0.55 + (0.45 * i) / tiers);
    const level = (i) => h / 2 - (i / tiers) * h;

    shape.moveTo(0, h / 2);
    for (let i = 1; i <= tiers; i++) {
      shape.lineTo(tip(i), level(i));
      shape.lineTo(tip(i) * 0.4, level(i));
    }
    for (let i = tiers; i >= 1; i--) {
      shape.lineTo(-tip(i) * 0.4, level(i));
      shape.lineTo(-tip(i), level(i));
    }
    shape.closePath();

    const tree = new THREE.Mesh(
      new THREE.ExtrudeGeometry(shape, { depth: 0.006, bevelEnabled: false }),
      felt(COLORS.pine)
    );
    tree.position.set(x, y, 0.011);
    face.add(tree);
  };

  // ==================== 小阳台 ====================
  const makeBalcony = ({ face, x, y, w, h, color }) => {
    face.add(box(w, h, 0.12, felt(color), x, y, 0.06));
  };

  // ==================== 花砖 ====================
  const makeLattice = (x, y, s = 0.42) => {
    const group = new THREE.Group();
    group.position.set(x, y, 0);

    const t = 0.05;
    const d = 0.03;
    const white = felt(COLORS.white);

    group.add(box(s, s, 0.01, felt(COLORS.recess), 0, 0, 0.005));

    group.add(box(s, t, d, white, 0, s / 2 - t / 2, d / 2));
    group.add(box(s, t, d, white, 0, -s / 2 + t / 2, d / 2));
    group.add(box(t, s, d, white, -s / 2 + t / 2, 0, d / 2));
    group.add(box(t, s, d, white, s / 2 - t / 2, 0, d / 2));

    const half = (s - 2 * t) / 2;
    const len = half * Math.SQRT2;
    const diag = [
      [half / 2, half / 2, -Math.PI / 4],
      [-half / 2, half / 2, Math.PI / 4],
      [-half / 2, -half / 2, -Math.PI / 4],
      [half / 2, -half / 2, Math.PI / 4],
    ];
    diag.forEach(([dx, dy, angle]) => {
      const bar = box(len, t * 0.8, d, white, dx, dy, d / 2);
      bar.rotation.z = angle;
      group.add(bar);
    });

    const center = box(0.08, 0.08, d, white, 0, 0, d / 2);
    center.rotation.z = Math.PI / 4;
    group.add(center);

    faces.front.add(group);
  };

  // ==================== 防盗窗 ====================
  const makeGrille = ({ face = faces.front, x, y, w = 0.72, h = 0.4 }) => {
    const group = new THREE.Group();
    group.position.set(x, y, 0);

    const out = 0.1;
    const top = h / 2 + 0.08;
    const bottom = -h / 2 - 0.08;

    for (let i = 0; i < 6; i++) {
      const wx = -w / 2 + 0.06 + (i * (w - 0.12)) / 5;
      const wobble = (i % 2 === 0 ? 1 : -1) * 0.025;
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(wx, top, 0),
        new THREE.Vector3(wx, top, out),
        new THREE.Vector3(wx + wobble, h / 4, out),
        new THREE.Vector3(wx - wobble, 0, out),
        new THREE.Vector3(wx + wobble, -h / 4, out),
        new THREE.Vector3(wx, bottom, out),
        new THREE.Vector3(wx, bottom, 0),
      ]);
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 0.008, 6), metal);
      tube.castShadow = true;
      group.add(tube);
    }

    for (let k = 0; k < 2; k++) {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-w / 2 - 0.05, 0.02 - k * 0.04, out),
        new THREE.Vector3(-0.1, 0.06 - k * 0.12, out + 0.01),
        new THREE.Vector3(0.1, -0.06 + k * 0.12, out + 0.01),
        new THREE.Vector3(w / 2 + 0.05, -0.02 + k * 0.04, out),
      ]);
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 32, 0.008, 6), metal);
      tube.castShadow = true;
      group.add(tube);
    }

    face.add(group);
  };

  // ==================== 晾衣绳 ====================
  const makeLaundry = (x1, x2, y) => {
    const lineZ = 0.06;
    const length = x2 - x1;

    const line = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, length, 6), metal);
    line.rotation.z = Math.PI / 2;
    line.position.set((x1 + x2) / 2, y, lineZ);
    faces.front.add(line);

    [x1, x2].forEach((hx) => {
      const hook = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.06, 6), metal);
      hook.rotation.x = Math.PI / 2;
      hook.position.set(hx, y, 0.03);
      faces.front.add(hook);
    });

    const clothes = [
      { name: 'cloth0', color: 0xc2549e, offset: length * 0.3, w: 0.14, h: 0.18 },
      { name: 'cloth1', color: 0x76757b, offset: length * 0.68, w: 0.1, h: 0.2 },
    ];
    clothes.forEach(({ name, color, offset, w, h }) => {
      const pivot = new THREE.Group();
      pivot.name = name;
      pivot.position.set(x1 + offset, y, lineZ);
      pivot.add(box(w, h, 0.012, felt(color), 0, -h / 2, 0));
      faces.front.add(pivot);
    });
  };

  // ==================== 盆栽 ====================
  const makePlant = (x, y) => {
    const group = new THREE.Group();
    group.name = 'plant';
    group.position.set(x, y, 0.06);

    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.26, 16), felt(0x4f9a3f));
    pot.rotation.z = Math.PI / 2;
    pot.castShadow = true;
    group.add(pot);

    group.add(box(0.04, 0.07, 0.03, felt(0xd9472b), 0.04, 0.07, 0));
    group.add(box(0.035, 0.05, 0.03, felt(0xd96aa8), -0.01, 0.06, 0.01));

    faces.front.add(group);
    return group;
  };

  // ==================== 正面 ====================
  const LEFT = -0.74;
  const MID = 0.03;
  const RIGHT = 0.77;
  const WIN_H = 0.4;
  const awningY = (wy) => wy + WIN_H / 2 + 0.26;

  makeAwning({ x: LEFT, y: awningY(2.84), color: COLORS.olive });
  makeWindow({ x: LEFT, y: 2.84, frame: COLORS.white, cols: 1, rows: 2 });

  makeAwning({ x: LEFT, y: awningY(2.2), color: COLORS.red, wire: true });
  makeWindow({ x: LEFT, y: 2.2, frame: COLORS.blue, cols: 2, rows: 2 });

  makeAwning({ x: LEFT, y: awningY(1.47), color: COLORS.olive });
  makeWindow({ x: LEFT, y: 1.47, frame: COLORS.white, cols: 2, rows: 2 });

  makeLaundry(-0.62, -0.26, 1.1);
  makeWindow({ x: LEFT, y: 0.62, frame: COLORS.white, cols: 1, rows: 2 });

  makeLattice(MID, 2.55);
  makeLattice(MID, 1.86);
  makeLattice(MID, 1.19);

  makeAwning({ x: RIGHT, y: awningY(2.87), color: COLORS.olive, w: 0.88 });
  makeWindow({ x: RIGHT, y: 2.87, frame: COLORS.yellow, cols: 2, rows: 2 });
  const plant = makePlant(RIGHT + 0.2, 2.6);

  makeWindow({ x: RIGHT, y: 2.2, frame: COLORS.white, cols: 2, rows: 1 });
  makeGrille({ x: RIGHT, y: 2.2 });

  makeAwning({ x: RIGHT, y: awningY(1.43), color: COLORS.awningBlue, wire: true });
  makeWindow({ x: RIGHT, y: 1.43, frame: COLORS.blue, cols: 1, rows: 2 });

  makeAwning({ x: RIGHT, y: awningY(0.74), color: COLORS.olive });
  makeWindow({ x: RIGHT, y: 0.74, frame: COLORS.yellow, cols: 2, rows: 2 });

  // ==================== 左侧面 ====================
  const L = faces.left;
  makeBlank({ face: L, x: -0.07, y: 3.14, w: 0.56, h: 0.43 });
  makeAwning({ face: L, x: -0.07, y: 2.93, w: 0.78, h: 0.33, color: COLORS.brown, band: COLORS.olive });
  makeWindow({ face: L, x: -0.05, y: 2.19, w: 0.68, h: 0.82, frame: COLORS.red, cols: 2, rows: 1, t: 0.075 });
  makeTree({ face: L, x: 0, y: 2.16, w: 0.42, h: 0.6 });

  makeBlank({ face: L, x: -0.05, y: 1.53, w: 0.54, h: 0.4 });
  makeAwning({ face: L, x: -0.04, y: 1.33, w: 0.78, h: 0.36, color: COLORS.brown });
  makeWindow({ face: L, x: -0.02, y: 0.54, w: 0.66, h: 0.83, frame: COLORS.grey, cols: 2, rows: 1, t: 0.1, bar: 0.15 });

  // ==================== 背面 ====================
  const B = faces.back;

  makeAwning({ face: B, x: -0.51, y: 3.45, w: 1.04, h: 0.45, color: COLORS.olive });
  makeWindow({ face: B, x: -0.51, y: 2.87, w: 1.0, h: 0.36, frame: COLORS.yellow, rows: 1, vSplits: [0.65] });
  makeAwning({ face: B, x: 0.57, y: 3.39, w: 1.1, h: 0.28, color: COLORS.olive });
  makeWindow({ face: B, x: 0.55, y: 2.91, w: 1.07, h: 0.4, frame: COLORS.white, rows: 3, vSplits: [0.38] });

  makeWindow({ face: B, x: -0.51, y: 2.26, w: 0.9, h: 0.31, frame: COLORS.white, rows: 2, vSplits: [0.63] });
  makeAwning({ face: B, x: 0.6, y: 2.68, w: 1.11, h: 0.24, color: COLORS.red });
  makeWindow({ face: B, x: 0.59, y: 2.25, w: 1.1, h: 0.41, frame: COLORS.blue, vSplits: [0.33, 0.69], hSplits: [0.64] });

  makeAwning({ face: B, x: -0.49, y: 1.97, w: 0.94, h: 0.35, color: COLORS.awningBlue, wire: true });
  makeWindow({ face: B, x: -0.5, y: 1.48, w: 0.92, h: 0.27, frame: COLORS.yellow, rows: 2, vSplits: [0.6] });
  makeAwning({ face: B, x: 0.53, y: 1.97, w: 1.08, h: 0.25, color: COLORS.olive });
  makeWindow({ face: B, x: 0.5, y: 1.53, w: 1.06, h: 0.37, frame: COLORS.white, rows: 2, vSplits: [0.45] });

  makeAwning({ face: B, x: -0.51, y: 1.23, w: 1.04, h: 0.36, color: COLORS.olive });
  makeWindow({ face: B, x: -0.52, y: 0.73, w: 0.94, h: 0.29, frame: COLORS.blue, vSplits: [0.68, 0.83], hSplits: [0.74] });
  makeWindow({ face: B, x: 0.51, y: 0.75, w: 0.93, h: 0.34, frame: COLORS.white, cols: 3, rows: 1 });
  makeGrille({ face: B, x: 0.51, y: 0.75, w: 0.93, h: 0.34 });

  // ==================== 右侧面 ====================
  const R = faces.right;
  makeAwning({ face: R, x: 0, y: 3.45, w: 0.85, h: 0.33, color: COLORS.grey });
  makeWindow({ face: R, x: -0.04, y: 2.9, w: 0.66, h: 0.5, frame: COLORS.yellow, cols: 2, rows: 1, t: 0.08 });

  makeBlank({ face: R, x: -0.03, y: 2.43, w: 0.52, h: 0.31 });
  makeAwning({ face: R, x: -0.05, y: 2.27, w: 0.77, h: 0.43, color: COLORS.olive, band: COLORS.brown });
  makeWindow({ face: R, x: -0.02, y: 1.42, w: 0.61, h: 0.81, frame: COLORS.teal, cols: 2, rows: 1, t: 0.09 });

  makeWindow({ face: R, x: -0.03, y: 0.74, w: 0.52, h: 0.42, frame: COLORS.yellow, cols: 2, rows: 1 });
  makeBalcony({ face: R, x: -0.02, y: 0.37, w: 0.7, h: 0.45, color: COLORS.balcony });

  // ==================== AnimationMixer：衣服在风里晃 ====================
  const mixer = new THREE.AnimationMixer(building);

  const makeSwingClip = (name, duration) => {
    const times = [0, duration / 2, duration];
    const outward = new THREE.NumberKeyframeTrack(`${name}.rotation[x]`, times, [-0.05, -0.35, -0.05]);
    const sideways = new THREE.NumberKeyframeTrack(`${name}.rotation[z]`, times, [-0.08, 0.08, -0.08]);
    outward.setInterpolation(THREE.InterpolateSmooth);
    sideways.setInterpolation(THREE.InterpolateSmooth);
    return new THREE.AnimationClip(`swing-${name}`, duration, [outward, sideways]);
  };

  const swing0 = mixer.clipAction(makeSwingClip('cloth0', 2.4));
  const swing1 = mixer.clipAction(makeSwingClip('cloth1', 2.0));
  swing0.play();
  swing1.play();
  swing1.time = 0.7;

  // ==================== GSAP 开场 ====================
  gsap.from(building.rotation, { y: -Math.PI / 2, duration: 2, ease: 'power3.out' });

  awnings.forEach((pivot, i) => {
    gsap.from(pivot.rotation, {
      x: 0,
      duration: 0.8,
      delay: 1 + i * 0.08,
      ease: 'back.out(3)',
    });
  });

  // ==================== 动画循环 ====================
  const timer = new THREE.Timer();

  renderer.setAnimationLoop((time) => {
    timer.update();
    const t = time * 0.001;
    mixer.update(timer.getDelta());
    plant.rotation.z = Math.sin(t * 1.5) * 0.04;
    renderer.render(scene, camera);
  });

  // ==================== 给 React 用的"遥控器" ====================
  let currentAngle = 0;
  let currentNight = false;

  // 转到某个角度（单位：度）。React 的 angle 一变，就会调用它
  const rotateTo = (degrees) => {
    if (degrees === currentAngle) return; // 没变就不动，免得打断开场动画
    currentAngle = degrees;
    gsap.to(building.rotation, {
      y: THREE.MathUtils.degToRad(degrees),
      duration: 0.9,
      ease: 'power3.inOut',
      overwrite: 'auto',
    });
  };

  // 白天 / 夜晚切换：灯光变暗，窗户一扇一扇亮起来
  const setNight = (night) => {
    if (night === currentNight) return;
    currentNight = night;
    const target = night ? NIGHT : DAY;
    const duration = 1.2;

    gsap.to(keyLight, { intensity: target.key, duration, overwrite: 'auto' });
    gsap.to(rimLight, { intensity: target.rim, duration, overwrite: 'auto' });
    gsap.to(rimLight.color, {
      r: target.rimColor.r,
      g: target.rimColor.g,
      b: target.rimColor.b,
      duration,
      overwrite: 'auto',
    });
    gsap.to(scene, { environmentIntensity: target.env, duration, overwrite: 'auto' });

    panes.forEach(({ material, lit }) => {
      gsap.to(material, {
        emissiveIntensity: night ? lit : 0,
        duration: 0.6,
        delay: night ? 0.4 + Math.random() * 1.2 : 0, // 晚上一扇一扇亮，早上一起关
        overwrite: 'auto',
      });
    });
  };

  // 清理：React 卸载组件时调用（开发模式下 StrictMode 也会故意调用一次）
  const dispose = () => {
    renderer.setAnimationLoop(null);
    resizeObserver.disconnect();

    gsap.killTweensOf([
      building.rotation,
      keyLight,
      rimLight,
      rimLight.color,
      scene,
      ...awnings.map((pivot) => pivot.rotation),
      ...panes.map((pane) => pane.material),
    ]);

    scene.traverse((object) => {
      object.geometry?.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => material?.dispose());
    });
    noiseTexture.dispose();
    envTexture.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  };

  return {
    rotateTo,
    setNight,
    dispose,
    // stats: { windows: windowCount, awnings: awnings.length },
  };
}
