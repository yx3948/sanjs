import styles from './index.module.css';

// 白天 / 夜晚开关。用三元表达式决定显示的文字和图标（条件渲染）
export default function LightSwitch({ isNight, onToggle }) {
  return (
    <button className={styles.switch} onClick={onToggle} aria-pressed={isNight}>
      <span className={`${styles.fill} ${isNight ? styles.empty : ''}`} />
      <span className={styles.text}>{isNight ? 'Night' : 'Day'}</span>
      <span className={styles.icon}>{isNight ? <MoonIcon /> : <SunIcon />}</span>
    </button>
  );
}

const SunIcon = () => (
  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
    <circle cx="12" cy="12" r="4" fill="currentColor" />
    <path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8" />
  </svg>
);

const MoonIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
    <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
  </svg>
);
