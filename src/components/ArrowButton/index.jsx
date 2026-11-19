import styles from './index.module.css';

// direction 是 "left" 或 "right"，和课上 Button 的 variant 是一个思路：
// 一个组件，靠 prop 决定长什么样
export default function ArrowButton({ direction = 'left', onClick }) {
  const label = direction === 'left' ? 'Turn left' : 'Turn right';

  return (
    <button className={styles.button} onClick={onClick} aria-label={label}>
      <svg
        className={direction === 'right' ? styles.flip : ''}
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M15 5l-7 7 7 7" />
      </svg>
    </button>
  );
}
