// 闪光张楷：随机出现、合成遗传、得分倍率。纯函数，可单独测试。
import { SHINY } from './config.js?v=c9d81fa9';

// 新出现的张楷（投放或合成产物）是不是闪光；parentShiny 表示参与合成的两个里有没有闪光
export function rollShiny(parentShiny = false, rand = Math.random) {
  if (parentShiny && rand() < SHINY.inherit) return true;
  return rand() < SHINY.chance;
}

// 有闪光参与的那次合成得分倍率
export const shinyMultiplier = parentShiny => (parentShiny ? SHINY.scoreMul : 1);
