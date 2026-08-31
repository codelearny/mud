<script setup lang="ts">
import { computed } from 'vue'
import { usePlayerStore } from '../stores/player'
import { getTalent } from '../engine/data-loader'
import type { Talent } from '../types'

const playerStore = usePlayerStore()
const offer = computed(() => playerStore.talentOffer)
const options = computed<Talent[]>(() =>
  (offer.value?.options ?? []).map(id => getTalent(id)).filter((t): t is Talent => !!t)
)
const rarityLabel: Record<string, string> = { common: '入门', rare: '寻常', epic: '精妙', legendary: '绝学' }

function pick(t: Talent) {
  playerStore.chooseTalent(t.id)
}
</script>

<template>
  <div v-if="offer" class="talent-overlay">
    <div class="talent-card">
      <div class="talent-header">⚡ 顿 悟</div>
      <p class="talent-sub">修为精进，天地感悟涌上心头。择一铭记，铸就此生武道。</p>
      <div class="talent-list">
        <button
          v-for="t in options"
          :key="t.id"
          class="talent-opt"
          :class="'rar-' + t.rarity"
          @click="pick(t)"
        >
          <div class="talent-row">
            <span class="talent-name">{{ t.name }}</span>
            <span class="talent-rar">{{ rarityLabel[t.rarity] }}</span>
          </div>
          <div class="talent-desc">{{ t.description }}</div>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.talent-overlay {
  position: fixed;
  inset: 0;
  background: rgba(10, 8, 6, 0.78);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
}
.talent-card {
  width: min(92vw, 560px);
  background: linear-gradient(160deg, #2a2118, #1a140e);
  border: 2px solid #d9a441;
  border-radius: 12px;
  padding: 22px 20px 26px;
  box-shadow: 0 0 36px rgba(217, 164, 65, 0.35);
}
.talent-header {
  text-align: center;
  font-size: 26px;
  font-weight: 700;
  letter-spacing: 6px;
  color: #f3d27a;
  text-shadow: 0 0 10px rgba(217, 164, 65, 0.6);
}
.talent-sub {
  text-align: center;
  color: #c9b48a;
  font-size: 13px;
  margin: 8px 0 16px;
}
.talent-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.talent-opt {
  text-align: left;
  background: #15100b;
  border: 1px solid #5a4a2f;
  border-left: 4px solid #8a6a35;
  border-radius: 8px;
  padding: 10px 14px;
  cursor: pointer;
  transition: transform 0.1s, border-color 0.1s, background 0.1s;
  color: #e8dcc0;
}
.talent-opt:hover {
  transform: translateY(-2px);
  background: #211a10;
  border-color: #d9a441;
}
.talent-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.talent-name {
  font-size: 16px;
  font-weight: 700;
  color: #f0e2c0;
}
.talent-rar {
  font-size: 12px;
  color: #9c8a63;
  border: 1px solid #5a4a2f;
  border-radius: 10px;
  padding: 1px 8px;
}
.talent-desc {
  font-size: 13px;
  color: #c2b08a;
  margin-top: 4px;
}
/* 稀有度色条 */
.rar-rare { border-left-color: #4a90d9; }
.rar-epic { border-left-color: #a85ad9; }
.rar-legendary { border-left-color: #e0a72e; }
.rar-rare .talent-rar { color: #7fb6e8; border-color: #4a90d9; }
.rar-epic .talent-rar { color: #c79ae8; border-color: #a85ad9; }
.rar-legendary .talent-rar { color: #f3c75a; border-color: #e0a72e; }
</style>
