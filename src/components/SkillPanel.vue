<script setup lang="ts">
import { computed } from 'vue'
import { usePlayerStore } from '../stores/player'
import { getAllSkills, getSkill } from '../engine/data-loader'
import type { SkillCategory } from '../types'

const playerStore = usePlayerStore()
const char = computed(() => playerStore.character)

const learnedSkills = computed(() => {
  if (!char.value) return []
  return char.value.learnedSkills.map(ls => ({
    ...getSkill(ls.skillId),
    level: ls.level,
    proficiency: ls.proficiency,
    proficiencyToNext: ls.proficiencyToNext,
  })).filter(s => s.id !== undefined)
})

const availableSkills = computed(() => {
  if (!char.value) return []
  const learned = new Set(char.value.learnedSkills.map(s => s.skillId))
  return getAllSkills().filter(s => !learned.has(s.id))
})

const categoryLabels: Record<SkillCategory, string> = {
  fist: '拳脚',
  sword: '剑法',
  blade: '刀法',
  internal: '内功',
  movement: '轻功',
  staff: '棍棒',
}

function canLearn(skillId: string): boolean {
  if (!char.value) return false
  const skill = getSkill(skillId)
  if (!skill) return false
  return char.value.level >= skill.unlockLevel
}

function learnSkill(skillId: string) {
  playerStore.learnNewSkill(skillId)
}
</script>

<template>
  <div class="panel" v-if="char">
    <div class="panel-title">已学武功</div>
    <div class="skill-list" v-if="learnedSkills.length > 0">
      <div class="skill-card" v-for="skill in learnedSkills" :key="skill.id">
        <div class="skill-info">
          <div class="skill-name">
            {{ skill.name }}
            <span class="equipped-badge">{{ categoryLabels[skill.category] }}</span>
            <span class="equipped-badge">第{{ skill.level }}层</span>
          </div>
          <div class="skill-desc">{{ skill.description }}</div>
          <div class="skill-desc" style="color: var(--text-tertiary);">
            威力 {{ skill.power }} · 耗内力 {{ skill.mpCost }} · 命中 {{ Math.round(skill.hitRate * 100) }}% · 暴击 {{ Math.round(skill.critRate * 100) }}%
          </div>
        </div>
      </div>
    </div>
    <div v-else class="empty-text">尚未习得任何武功</div>

    <div class="panel-title" style="margin-top: 12px;">江湖绝学</div>
    <div class="skill-list">
      <div
        class="skill-card"
        v-for="skill in availableSkills"
        :key="skill.id"
        :style="{ opacity: canLearn(skill.id) ? 1 : 0.5 }"
      >
        <div class="skill-info">
          <div class="skill-name">
            {{ skill.name }}
            <span class="equipped-badge">{{ categoryLabels[skill.category] }}</span>
          </div>
          <div class="skill-desc">{{ skill.description }}</div>
          <div class="skill-desc" style="color: var(--text-tertiary);">
            威力 {{ skill.power }} · 耗内力 {{ skill.mpCost }} · 需第{{ skill.unlockLevel }}重
          </div>
        </div>
        <div class="skill-actions">
          <button
            class="btn btn-primary"
            :disabled="!canLearn(skill.id)"
            @click="learnSkill(skill.id)"
          >
            {{ canLearn(skill.id) ? '参悟' : '未达' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
