import styles from './index.module.css';

// 一张面的卡片：名字在左下角，右上角一个小圆点
// active 时圆点变绿，表示现在正对着这一面
export default function FaceCard({ name, active, onClick }) {
  return (
    <button className={styles.card} onClick={onClick} aria-pressed={active}>
      <span className={`${styles.dot} ${active ? styles.on : ''}`} />
      <span className={styles.name}>{name}</span>
    </button>
  );
}
