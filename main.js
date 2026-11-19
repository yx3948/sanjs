import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import gsap from 'gsap';

const app = document.querySelector('#app');
const slider = document.querySelector('#angle');

// ==================== 渲染器 ====================
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true; // 打开阴影：遮阳棚会在墙上投影
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xa2cffe);

// ==================== 环境贴图（课上的 Environment map） ====================
// RoomEnvironment 是 Three.js 自带的"摄影棚"，不需要外部文件
// 它代替了原来的 AmbientLight，让暗面不会死黑，金属防盗窗也会有反光
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment()).texture;
pmrem.dispose();
scene.environmentIntensity = 0.5; // 环境光强度，调小一点保留暖色灯光的氛围

// ==================== 楼的尺寸 ====================
const W = 2.4; // 宽
const H = 3.5; // 高
const D = 1.8; // 深
const FZ = D / 2; // 正面所在的 z 位置，所有细节都贴在这里

// ==================== 相机：正对着楼 ====================
const camera = new THREE.PerspectiveCamera(
  50,
  window.innerWidth / window.innerHeight,
  1,
  1000
);
camera.position.set(0, H / 2, 7.5);
camera.lookAt(0, H / 2, 0);

const onResize = () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
};
window.addEventListener('resize', onResize);

// ==================== 灯光：暖色 ====================
// 主光：正面 45° 往下
const keyLight = new THREE.DirectionalLight(0xffd6a8, 2.2);
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

// 轮廓光：从后面打
const rimLight = new THREE.DirectionalLight(0xffa860, 2);
rimLight.position.set(-5, 3, -8);

scene.add(keyLight, keyLight.target, rimLight);

// ==================== 毛毡材质 ====================
// 用 canvas 画一张随机噪点图，当作凹凸贴图，模拟毛毡的粗糙表面
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

// 做一块指定颜色的"毛毡"
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

// 毛毡颜色（参考你的作品）
const COLORS = {
  wall: 0xbcab95,      // 墙：米色
  pane: 0xe2d5bd,      // 窗玻璃：浅米色，和白窗框拉开对比
  white: 0xefefea,     // 白色窗框
  blue: 0x9cc7dc,      // 浅蓝窗框
  yellow: 0xe6dc8a,    // 浅黄窗框
  olive: 0x4a5230,     // 橄榄绿遮阳棚
  red: 0xd9472b,       // 红色遮阳棚
  awningBlue: 0x2a8fc4,// 蓝色遮阳棚
  recess: 0xb3a592,    // 花砖后面的阴影色
};

// 金属材质：防盗窗、晾衣绳、遮阳棚上的铁丝
const metal = new THREE.MeshStandardMaterial({
  color: 0xd0d0d0,
  metalness: 1,
  roughness: 0.25,
});

// 小工具：做一个方块，放到指定位置
const box = (w, h, d, material, x = 0, y = 0, z = 0) => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
};

// ==================== 楼体 ====================
// 整栋楼放在一个 Group 里，slider 转的是这个 Group，正面的细节会跟着一起转
const building = new THREE.Group();
scene.add(building);

// 用 Shape 画出楼的正面轮廓（底部中间挖一个门洞），再 Extrude 拉出厚度
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

const bodyGeometry = new THREE.ExtrudeGeometry(outline, {
  depth: D,
  bevelEnabled: false,
});
bodyGeometry.translate(0, 0, -D / 2); // 让楼的中心在原点，转的时候不会偏
const body = new THREE.Mesh(bodyGeometry, felt(COLORS.wall));
body.castShadow = true;
body.receiveShadow = true;
building.add(body);

// ==================== 窗户 ====================
// cols、rows：窗格分几列几行
const makeWindow = ({ x, y, frame, cols = 1, rows = 2, w = 0.72, h = 0.4 }) => {
  const group = new THREE.Group();
  group.position.set(x, y, FZ);

  const t = 0.06;  // 窗框粗细
  const d = 0.03;  // 窗框厚度
  const frameMat = felt(frame);

  group.add(box(w, h, 0.01, felt(COLORS.pane), 0, 0, 0.005)); // 玻璃

  // 外框
  group.add(box(w, t, d, frameMat, 0, h / 2 - t / 2, d / 2));
  group.add(box(w, t, d, frameMat, 0, -h / 2 + t / 2, d / 2));
  group.add(box(t, h, d, frameMat, -w / 2 + t / 2, 0, d / 2));
  group.add(box(t, h, d, frameMat, w / 2 - t / 2, 0, d / 2));

  // 中间的窗棂
  for (let i = 1; i < cols; i++) {
    group.add(box(t * 0.8, h, d, frameMat, -w / 2 + (i * w) / cols, 0, d / 2));
  }
  for (let j = 1; j < rows; j++) {
    group.add(box(w, t * 0.8, d, frameMat, 0, -h / 2 + (j * h) / rows, d / 2));
  }

  building.add(group);
};

// ==================== 遮阳棚 ====================
// 遮阳棚绕自己的上边缘旋转：先放一个 pivot（转轴）在上边缘，再把布挂在下面
const awnings = []; // 记下来，开场时用 GSAP 让它们一个个"打开"
const AWNING_TILT = -0.5;

const makeAwning = ({ x, y, color, w = 0.8, wire = false }) => {
  const pivot = new THREE.Group();
  pivot.position.set(x, y, FZ);

  const flapH = 0.26;
  const flap = box(w, flapH, 0.025, felt(color), 0, -flapH / 2, 0.0125);
  pivot.add(flap);

  // 有些遮阳棚上缝着一根铁丝
  if (wire) {
    const wireMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.006, 0.006, w * 0.85, 8),
      metal
    );
    wireMesh.rotation.z = Math.PI / 2;
    wireMesh.position.set(0, -0.04, 0.03);
    pivot.add(wireMesh);
  }

  pivot.rotation.x = AWNING_TILT; // 下边缘往外翘
  awnings.push(pivot);
  building.add(pivot);
};

// ==================== 花砖（中间那列镂空方块） ====================
const makeLattice = (x, y, s = 0.42) => {
  const group = new THREE.Group();
  group.position.set(x, y, FZ);

  const t = 0.05;
  const d = 0.03;
  const white = felt(COLORS.white);

  group.add(box(s, s, 0.01, felt(COLORS.recess), 0, 0, 0.005)); // 镂空后面的阴影

  // 外框
  group.add(box(s, t, d, white, 0, s / 2 - t / 2, d / 2));
  group.add(box(s, t, d, white, 0, -s / 2 + t / 2, d / 2));
  group.add(box(t, s, d, white, -s / 2 + t / 2, 0, d / 2));
  group.add(box(t, s, d, white, s / 2 - t / 2, 0, d / 2));

  // 里面的菱形：四根斜着的条
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

  // 正中间的小方块
  const center = box(0.08, 0.08, d, white, 0, 0, d / 2);
  center.rotation.z = Math.PI / 4;
  group.add(center);

  building.add(group);
};

// ==================== 防盗窗（弯弯曲曲的铁丝） ====================
const makeGrille = (x, y, w = 0.72, h = 0.4) => {
  const group = new THREE.Group();
  group.position.set(x, y, FZ);

  const out = 0.1; // 铁丝离墙多远
  const top = h / 2 + 0.08;
  const bottom = -h / 2 - 0.08;

  // 竖着的铁丝：用 CatmullRomCurve3 穿过几个点，做成歪歪扭扭的手工感
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

  // 横着缠的两根
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

  building.add(group);
};

// ==================== 晾衣绳 ====================
// 每件衣服放在一个有名字的 Group 里（转轴在绳子上），AnimationMixer 靠名字找到它们
const makeLaundry = (x1, x2, y) => {
  const lineZ = FZ + 0.06;
  const length = x2 - x1;

  const line = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, length, 6), metal);
  line.rotation.z = Math.PI / 2;
  line.position.set((x1 + x2) / 2, y, lineZ);
  building.add(line);

  // 两头钉在墙上的钩子
  [x1, x2].forEach((hx) => {
    const hook = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.06, 6), metal);
    hook.rotation.x = Math.PI / 2;
    hook.position.set(hx, y, FZ + 0.03);
    building.add(hook);
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
    building.add(pivot);
  });
};

// ==================== 窗台上的小盆栽 ====================
const makePlant = (x, y) => {
  const group = new THREE.Group();
  group.name = 'plant';
  group.position.set(x, y, FZ + 0.06);

  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.26, 16), felt(0x4f9a3f));
  pot.rotation.z = Math.PI / 2;
  pot.castShadow = true;
  group.add(pot);

  group.add(box(0.04, 0.07, 0.03, felt(0xd9472b), 0.04, 0.07, 0));
  group.add(box(0.035, 0.05, 0.03, felt(0xd96aa8), -0.01, 0.06, 0.01));

  building.add(group);
  return group;
};

// ==================== 按照你的作品摆放 ====================
const LEFT = -0.74;
const MID = 0.03;
const RIGHT = 0.77;
const WIN_H = 0.4;
const awningY = (wy) => wy + WIN_H / 2 + 0.26; // 遮阳棚挂在窗户上方

// 左边一列
makeAwning({ x: LEFT, y: awningY(2.84), color: COLORS.olive });
makeWindow({ x: LEFT, y: 2.84, frame: COLORS.white, cols: 1, rows: 2 });

makeAwning({ x: LEFT, y: awningY(2.2), color: COLORS.red, wire: true });
makeWindow({ x: LEFT, y: 2.2, frame: COLORS.blue, cols: 2, rows: 2 });

makeAwning({ x: LEFT, y: awningY(1.47), color: COLORS.olive });
makeWindow({ x: LEFT, y: 1.47, frame: COLORS.white, cols: 2, rows: 2 });

makeLaundry(-0.62, -0.26, 1.1);
makeWindow({ x: LEFT, y: 0.62, frame: COLORS.white, cols: 1, rows: 2 });

// 中间一列：三块花砖
makeLattice(MID, 2.55);
makeLattice(MID, 1.86);
makeLattice(MID, 1.19);

// 右边一列
makeAwning({ x: RIGHT, y: awningY(2.87), color: COLORS.olive, w: 0.88 });
makeWindow({ x: RIGHT, y: 2.87, frame: COLORS.yellow, cols: 2, rows: 2 });
const plant = makePlant(RIGHT + 0.2, 2.6);

makeWindow({ x: RIGHT, y: 2.2, frame: COLORS.white, cols: 2, rows: 1 });
makeGrille(RIGHT, 2.2);

makeAwning({ x: RIGHT, y: awningY(1.43), color: COLORS.awningBlue, wire: true });
makeWindow({ x: RIGHT, y: 1.43, frame: COLORS.blue, cols: 1, rows: 2 });

makeAwning({ x: RIGHT, y: awningY(0.74), color: COLORS.olive });
makeWindow({ x: RIGHT, y: 0.74, frame: COLORS.yellow, cols: 2, rows: 2 });

// ==================== AnimationMixer：衣服在风里晃 ====================
// 课上的例子用的是模型文件里自带的动画；这里我们自己用关键帧做一段动画
const mixer = new THREE.AnimationMixer(building);

const makeSwingClip = (name, duration) => {
  const times = [0, duration / 2, duration];
  // 往外飘（绕 x 轴），同时左右摆（绕 z 轴）
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
swing1.time = 0.7; // 错开一点，两件衣服不要同步摆

// ==================== GSAP ====================
// 开场：楼转进来
gsap.from(building.rotation, { y: -Math.PI / 2, duration: 2, ease: 'power3.out' });

// 开场：遮阳棚一个接一个"啪"地打开
awnings.forEach((pivot, i) => {
  gsap.from(pivot.rotation, {
    x: 0,
    duration: 0.8,
    delay: 1 + i * 0.15,
    ease: 'back.out(3)',
  });
});

// Slider：不再一下跳到那个角度，而是平滑地转过去
slider.addEventListener('input', () => {
  const degrees = Number(slider.value);
  gsap.to(building.rotation, {
    y: THREE.MathUtils.degToRad(degrees),
    duration: 0.8,
    ease: 'power3.out',
    overwrite: 'auto',
  });
});

// ==================== 动画循环 ====================
const timer = new THREE.Timer();

renderer.setAnimationLoop((time) => {
  timer.update();
  const t = time * 0.001; // 毫秒 → 秒

  mixer.update(timer.getDelta()); // 推进衣服的动画

  plant.rotation.z = Math.sin(t * 1.5) * 0.04; // 盆栽轻轻晃

  renderer.render(scene, camera);
});
