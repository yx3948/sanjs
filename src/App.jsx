import { useEffect, useState } from 'react';
import Building from './components/Building';
import FaceCard from './components/FaceCard';
// import Stat from './components/Stat';
import ArrowButton from './components/ArrowButton';
import LightSwitch from './components/LightSwitch';
import styles from './App.module.css';

// 四个面和它们对应的角度
// 楼转 +90° 时，左面会转到正前方，所以 Left = 90
const FACES = [
  { name: 'Front', angle: 0 },
  { name: 'Left', angle: 90 },
  { name: 'Back', angle: 180 },
  { name: 'Right', angle: 270 },
];

// 把任意角度换算到 0~359，比如 -90 → 270，450 → 90
const normalize = (degrees) => ((degrees % 360) + 360) % 360;

export default function App() {
  // angle 不限制在 0~359：一直按 ← 会变成 90、180、270、360、450……
  // 这样楼永远朝你按的方向转，不会在 359° → 0° 时突然倒转一整圈
  const [angle, setAngle] = useState(0);
  const [isNight, setIsNight] = useState(false);
  // const [stats, setStats] = useState({ windows: 0, awnings: 0 });

  const current = normalize(angle);
  const activeFace = FACES.find((face) => face.angle === current);

  // ← 看左边那一面，→ 看右边那一面
  // 用函数式更新 (a) => a + 90，连按很快也不会丢步
  const turnLeft = () => setAngle((a) => a + 90);
  const turnRight = () => setAngle((a) => a - 90);

  // 点卡片：走最近的那条路转过去（比如从 Front 去 Right，往回转 90°，不是往前转 270°）
  const goTo = (target) => {
    let delta = normalize(target - current);
    if (delta > 180) delta -= 360;
    setAngle(angle + delta);
  };

  // 键盘的左右方向键也能转。监听的是 window，所以要在 cleanup 里移除
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'ArrowLeft') setAngle((a) => a + 90);
      if (e.key === 'ArrowRight') setAngle((a) => a - 90);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className={`${styles.app} ${isNight ? styles.night : ''}`}>
      {/* 顶部一条细栏：四个面的按钮 + 数字 + 白天/夜晚 */}
      <header className={styles.topbar}>
        <nav className={styles.cards}>
          {FACES.map((face) => (
            <FaceCard
              key={face.name}
              name={face.name}
              active={face.angle === current}
              onClick={() => goTo(face.angle)}
            />
          ))}
        </nav>

        <LightSwitch isNight={isNight} onToggle={() => setIsNight((n) => !n)} />
      </header>

      {/* 下面整块都给楼 */}
      <main className={styles.stage}>
        <Building angle={angle} isNight={isNight}/>

        <div className={styles.arrows}>
          <ArrowButton direction="left" onClick={turnLeft} />
          <span className={styles.faceName}>{activeFace?.name}</span>
          <ArrowButton direction="right" onClick={turnRight} />
        </div>
      </main>
    </div>
  );
}
