import { useEffect, useRef } from 'react';
import { createScene } from '../../scene/createScene';
import styles from './index.module.css';

// 3D 楼。Three.js 的部分还是命令式的（在 createScene 里），
// 这个组件只负责：什么时候创建、什么时候清理、props 变了通知它。
export default function Building({ angle, isNight, onStats }) {
  const mountRef = useRef(null); // 用法 1：拿到下面那个 <div> 真实的 DOM 节点
  const sceneRef = useRef(null); // 用法 2：在多次渲染之间记住 scene 的"遥控器"

  // 只在组件第一次出现时创建场景（依赖数组是 []）
  useEffect(() => {
    const scene = createScene(mountRef.current);
    sceneRef.current = scene;
    // onStats(scene.stats); // 把窗户、遮阳棚的数量告诉父组件

    // cleanup：组件被移除时把画布、动画、监听全部清理掉
    // 开发模式下 StrictMode 会故意"创建 → 清理 → 再创建"一次，
    // 如果这里没写好，屏幕上就会出现两栋楼
    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
    // onStats 是父组件的 setStats，不会变，所以这里只需要跑一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // angle 变了 → 转过去
  useEffect(() => {
    sceneRef.current?.rotateTo(angle);
  }, [angle]);

  // isNight 变了 → 切换白天 / 夜晚
  useEffect(() => {
    sceneRef.current?.setNight(isNight);
  }, [isNight]);

  return <div ref={mountRef} className={styles.mount} />;
}
