<script setup lang="ts">
import { computed } from 'vue'
import { usePlayerStore } from '../stores/player'
import { getAllSkills, getSkill, getItem } from '../engine/data-loader'
import { skillTags, skillSchoolLabel, WEAPON_SCHOOL_LABELS, weaponSchoolMatches } from '../engine/skill-utils'
import type { Skill, SkillCategory } from '../types'

const playerStore = usePlayerStore()
const char = computed(() => playerStore.character)

type LearnedSkillView = Skill & {
  level: number
  proficiency: number
  proficiencyToNext: number
}

const learnedSkills = computed<LearnedSkillView[]>(() => {
  if (!char.value) return []
  return char.value.learnedSkills
    .map(ls => {
      const skill = getSkill(ls.skillId)
      if (!skill) return null
      return {
        ...skill,
        level: ls.level,
        proficiency: ls.proficiency,
        proficiencyToNext: ls.proficiencyToNext,
      }
    })
    .filter((s): s is LearnedSkillView => s !== null)
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

// 当前装备兵器及其流派，用于标注「功法 vs 当前兵器」的相性
const equippedWeapon = computed(() => {
  const id = char.value?.equipment.weapon
  return id ? getItem(id) : undefined
})
const equippedSchoolLabel = computed(() => {
  if (!equippedWeapon.value?.school) return '空手（拳脚）'
  return WEAPON_SCHOOL_LABELS[equippedWeapon.value.school]
})
// 返回该功法相对于当前兵器的相性：'match' 相合 / 'mismatch' 相克（折扣）/ null 无需兵器（内功轻功）
function affinityOf(skill: Skill): 'match' | 'mismatch' | null {
  if (!['sword', 'blade', 'fist', 'staff'].includes(skill.category)) return null
  return weaponSchoolMatches(equippedWeapon.value?.school, skill) ? 'match' : 'mismatch'
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
    <div class="weapon-current" v-if="equippedWeapon">
      当前兵器：{{ equippedWeapon.name }}（{{ equippedSchoolLabel }}）— 功法与兵器相合方能尽展威能
    </div>
    <div v-else class="weapon-current">
      当前兵器：空手（拳脚）— 拳脚功法相合，刀/剑/棍法则威力折扣
    </div>
    <div class="skill-list" v-if="learnedSkills.length > 0">
      <div class="skill-card" v-for="skill in learnedSkills" :key="skill.id">
        <div class="skill-info">
          <div class="skill-name">
            {{ skill.name }}
            <span class="equipped-badge">{{ categoryLabels[skill.category] }}</span>
            <span class="equipped-badge" v-if="skillSchoolLabel(skill)">适配{{ skillSchoolLabel(skill) }}</span>
            <span class="equipped-badge">第{{ skill.level }}层</span>
            <span class="skill-tag good" v-if="affinityOf(skill) === 'match'">相合 +10%</span>
            <span class="skill-tag warn" v-else-if="affinityOf(skill) === 'mismatch'">不合 ×0.6</span>
          </div>
          <div class="skill-desc">{{ skill.description }}</div>
          <div class="skill-desc" style="color: var(--text-tertiary);">
            威力 {{ skill.power }} · 耗内力 {{ skill.mpCost }} · 命中 {{ Math.round(skill.hitRate * 100) }}% · 暴击 {{ Math.round(skill.critRate * 100) }}%
          </div>
          <div class="skill-tags" v-if="skillTags(skill).length">
            <span class="skill-tag" v-for="t in skillTags(skill)" :key="t">{{ t }}</span>
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
            <span class="equipped-badge" v-if="skillSchoolLabel(skill)">适配{{ skillSchoolLabel(skill) }}</span>
            <span class="skill-tag good" v-if="affinityOf(skill) === 'match'">相合 +10%</span>
            <span class="skill-tag warn" v-else-if="affinityOf(skill) === 'mismatch'">不合 ×0.6</span>
          </div>
          <div class="skill-desc">{{ skill.description }}</div>
          <div class="skill-desc" style="color: var(--text-tertiary);">
            威力 {{ skill.power }} · 耗内力 {{ skill.mpCost }} · 需第{{ skill.unlockLevel }}重
          </div>
          <div class="skill-tags" v-if="skillTags(skill).length">
            <span class="skill-tag" v-for="t in skillTags(skill)" :key="t">{{ t }}</span>
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
