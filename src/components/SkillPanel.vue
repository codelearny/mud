<script setup lang="ts">
import { computed, ref } from 'vue'
import { usePlayerStore } from '../stores/player'
import { getAllSkills, getSkill, getItem, getAllItems } from '../engine/data-loader'
import {
  skillTags, skillSchoolLabel, passiveTags, triggerLabel, inferTrigger,
  WEAPON_SCHOOL_LABELS, weaponSchoolMatches, MAX_EQUIPPED_SKILLS,
} from '../engine/skill-utils'
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

// 主动战技 / 被动心法分列：前者要占战技槽，后者习得即常驻生效
const activeSkills = computed(() => learnedSkills.value.filter(s => s.type === 'active'))
const passiveSkills = computed(() => learnedSkills.value.filter(s => s.type === 'passive'))

const equippedIds = computed(() => char.value?.equippedSkills ?? [])
const slots = computed(() => {
  const filled = equippedIds.value
    .map(id => getSkill(id))
    .filter((s): s is Skill => !!s)
  const list = [...filled]
  while (list.length < MAX_EQUIPPED_SKILLS) list.push(undefined as unknown as Skill)
  return list
})

const availableSkills = computed(() => {
  if (!char.value) return []
  const learned = new Set(char.value.learnedSkills.map(s => s.skillId))
  // 仅展示当前立即可参悟者（修为/银两/秘籍皆备）；未达条件者不显，避免列出大量"未生效"的绝学
  return getAllSkills().filter(s => !learned.has(s.id) && canLearn(s.id))
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

// —— 武学获取：按稀有度分层设计不同获取难度 ——
//   common 入门：修为达标即可参悟（分文不取）
//   rare   寻常：修为达标 + 银两
//   epic   精妙：修为达标 + 持有对应秘籍（中级头目掉落 / 店铺有售）
//   legendary 绝学：修为达标 + 秘籍 + 银两（秘籍仅终极头目掉落，参悟后消耗）
const RARITY_LABEL: Record<string, string> = {
  common: '入门',
  rare: '寻常',
  epic: '精妙',
  legendary: '绝学',
}
const RARITY_CLASS: Record<string, string> = {
  common: 'rare-common',
  rare: 'rare-rare',
  epic: 'rare-epic',
  legendary: 'rare-legendary',
}

function rarityOf(skill: Skill): string {
  return skill.rarity ?? 'common'
}

// 参悟条件校验，按钮与提示复用同一结果
function learnCheck(skill: Skill) {
  const rarity = rarityOf(skill)
  const c = char.value
  const goldCost = playerStore.learnGoldCost(skill)
  const manual = rarity === 'epic' || rarity === 'legendary'
    ? getAllItems().find(i => i.skillId === skill.id)
    : undefined
  if (!c) return { ok: false, reason: '尚无角色', goldCost, manual, rarity }
  const levelOk = c.level >= skill.unlockLevel
  const goldOk = c.gold >= goldCost
  const hasManual = manual ? c.inventory.some(i => i.itemId === manual.id && i.quantity > 0) : true
  let reason = ''
  if (!levelOk) reason = '需第' + skill.unlockLevel + '重'
  else if (!goldOk) reason = '银两 ' + goldCost
  else if (!hasManual) reason = '需' + (manual?.name ?? '秘籍')
  return { ok: levelOk && goldOk && hasManual, reason, goldCost, manual, rarity }
}

function canLearn(skillId: string): boolean {
  const skill = getSkill(skillId)
  if (!skill) return false
  return learnCheck(skill).ok
}

const learnMsg = ref('')
function learnSkill(skillId: string) {
  const res = playerStore.learnNewSkill(skillId)
  learnMsg.value = res.ok ? '参悟有成，习得新武功！' : res.reason ?? '参悟失败'
  setTimeout(() => { learnMsg.value = '' }, 2600)
}

const slotMsg = ref('')
function toggleEquip(skillId: string) {
  const equipped = equippedIds.value.includes(skillId)
  if (equipped) {
    playerStore.unequipSkill(skillId)
    slotMsg.value = '已卸下战技'
  } else {
    const res = playerStore.equipSkill(skillId)
    slotMsg.value = res.ok ? '已装备战技' : res.reason ?? '装备失败'
  }
  setTimeout(() => { slotMsg.value = '' }, 2000)
}
</script>

<template>
  <div class="panel" v-if="char">
    <!-- ===== 战技槽：自动战斗只会释放槽中的主动功法 ===== -->
    <div class="panel-title">战技槽（{{ equippedIds.length }}/{{ MAX_EQUIPPED_SKILLS }} · 自动施展）</div>
    <div class="weapon-current" v-if="equippedWeapon">
      当前兵器：{{ equippedWeapon.name }}（{{ equippedSchoolLabel }}）— 功法与兵器相合方能尽展威能
    </div>
    <div v-else class="weapon-current">
      当前兵器：空手（拳脚）— 拳脚功法相合，刀/剑/棍法则威力折扣
    </div>
    <div v-if="slotMsg" class="learn-msg">{{ slotMsg }}</div>
    <div class="slot-list">
      <div
        v-for="(s, i) in slots"
        :key="i"
        class="slot-card"
        :class="{ 'slot-empty': !s }"
      >
        <template v-if="s">
          <div class="slot-name">
            {{ s.name }}
            <span class="skill-tag" :class="RARITY_CLASS[rarityOf(s)]">{{ RARITY_LABEL[rarityOf(s)] }}</span>
          </div>
          <div class="slot-meta">{{ triggerLabel(inferTrigger(s)) }} · 冷却 {{ s.cooldown ?? 0 }} 回合 · 内力 {{ s.mpCost }}</div>
          <div class="skill-tags" v-if="skillTags(s).length">
            <span class="skill-tag" v-for="t in skillTags(s)" :key="t">{{ t }}</span>
          </div>
          <button class="btn btn-slim" @click="toggleEquip(s.id)">卸下</button>
        </template>
        <template v-else>
          <div class="slot-empty-text">空槽位</div>
          <div class="slot-meta">从下方「已学战技」中挑选装配</div>
        </template>
      </div>
    </div>

    <!-- ===== 已学主动战技 ===== -->
    <div class="panel-title" style="margin-top: 12px;">已学战技（须装备方会施展）</div>
    <div class="skill-list" v-if="activeSkills.length > 0">
      <div class="skill-card" v-for="skill in activeSkills" :key="skill.id">
        <div class="skill-info">
          <div class="skill-name">
            {{ skill.name }}
            <span class="skill-tag" :class="RARITY_CLASS[rarityOf(skill)]">{{ RARITY_LABEL[rarityOf(skill)] }}</span>
            <span class="equipped-badge">{{ categoryLabels[skill.category] }}</span>
            <span class="equipped-badge" v-if="skillSchoolLabel(skill)">适配{{ skillSchoolLabel(skill) }}</span>
            <span class="equipped-badge">第{{ skill.level }}层</span>
            <span class="skill-tag good" v-if="affinityOf(skill) === 'match'">相合 +10%</span>
            <span class="skill-tag warn" v-else-if="affinityOf(skill) === 'mismatch'">不合 ×0.6</span>
          </div>
          <div class="skill-desc">{{ skill.description }}</div>
          <div class="skill-desc" style="color: var(--text-tertiary);">
            威力 {{ skill.power }} · 耗内力 {{ skill.mpCost }} · 冷却 {{ skill.cooldown ?? 0 }} 回合 ·
            命中 {{ Math.round(skill.hitRate * 100) }}% · 暴击 {{ Math.round(skill.critRate * 100) }}%
          </div>
          <div class="skill-desc" style="color: var(--text-accent);">
            触发：{{ triggerLabel(inferTrigger(skill)) }}
          </div>
          <div class="skill-tags" v-if="skillTags(skill).length">
            <span class="skill-tag" v-for="t in skillTags(skill)" :key="t">{{ t }}</span>
          </div>
        </div>
        <div class="skill-actions">
          <button
            class="btn"
            :class="equippedIds.includes(skill.id) ? '' : 'btn-primary'"
            @click="toggleEquip(skill.id)"
          >{{ equippedIds.includes(skill.id) ? '卸下' : '装备' }}</button>
        </div>
      </div>
    </div>
    <div v-else class="empty-text">尚未习得任何主动战技</div>

    <!-- ===== 已学被动心法 ===== -->
    <div class="panel-title" style="margin-top: 12px;">已学心法（习得即常驻生效）</div>
    <div class="skill-list" v-if="passiveSkills.length > 0">
      <div class="skill-card" v-for="skill in passiveSkills" :key="skill.id">
        <div class="skill-info">
          <div class="skill-name">
            {{ skill.name }}
            <span class="skill-tag" :class="RARITY_CLASS[rarityOf(skill)]">{{ RARITY_LABEL[rarityOf(skill)] }}</span>
            <span class="equipped-badge">{{ categoryLabels[skill.category] }}</span>
            <span class="equipped-badge">第{{ skill.level }}层</span>
            <span class="skill-tag good">被动</span>
          </div>
          <div class="skill-desc">{{ skill.description }}</div>
          <div class="skill-tags" v-if="passiveTags(skill).length">
            <span class="skill-tag" v-for="t in passiveTags(skill)" :key="t">{{ t }}</span>
          </div>
        </div>
      </div>
    </div>
    <div v-else class="empty-text">尚未习得任何内功心法</div>

    <!-- ===== 可参悟绝学 ===== -->
    <div class="panel-title" style="margin-top: 12px;">江湖绝学</div>
    <div v-if="learnMsg" class="learn-msg">{{ learnMsg }}</div>
    <div class="skill-list" v-if="availableSkills.length">
      <div
        class="skill-card"
        v-for="skill in availableSkills"
        :key="skill.id"
      >
        <div class="skill-info">
          <div class="skill-name">
            {{ skill.name }}
            <span class="skill-tag" :class="RARITY_CLASS[rarityOf(skill)]">{{ RARITY_LABEL[rarityOf(skill)] }}</span>
            <span class="equipped-badge">{{ categoryLabels[skill.category] }}</span>
            <span class="equipped-badge" v-if="skillSchoolLabel(skill)">适配{{ skillSchoolLabel(skill) }}</span>
            <span class="skill-tag" v-if="skill.type === 'passive'">被动</span>
            <span class="skill-tag good" v-if="affinityOf(skill) === 'match'">相合 +10%</span>
            <span class="skill-tag warn" v-else-if="affinityOf(skill) === 'mismatch'">不合 ×0.6</span>
          </div>
          <div class="skill-desc">{{ skill.description }}</div>
          <div class="skill-desc" style="color: var(--text-tertiary);" v-if="skill.type === 'active'">
            威力 {{ skill.power }} · 耗内力 {{ skill.mpCost }} · 需第{{ skill.unlockLevel }}重<template v-if="learnCheck(skill).goldCost > 0"> · 银两 {{ learnCheck(skill).goldCost }}</template>
          </div>
          <div class="skill-desc" style="color: var(--text-tertiary);" v-else>
            常驻生效 · 无需装备 · 需第{{ skill.unlockLevel }}重<template v-if="learnCheck(skill).goldCost > 0"> · 银两 {{ learnCheck(skill).goldCost }}</template>
          </div>
          <div class="skill-tags" v-if="skill.type === 'passive' && passiveTags(skill).length">
            <span class="skill-tag" v-for="t in passiveTags(skill)" :key="t">{{ t }}</span>
          </div>
          <div class="skill-tags" v-else-if="skillTags(skill).length">
            <span class="skill-tag" v-for="t in skillTags(skill)" :key="t">{{ t }}</span>
          </div>
          <div class="skill-desc learn-req" v-if="learnCheck(skill).manual">
            需「{{ learnCheck(skill).manual?.name }}」
            <span v-if="char?.inventory?.some(i => i.itemId === learnCheck(skill).manual?.id && i.quantity > 0)" class="own">（已持有）</span>
            <span v-else class="lack">（未得）</span>
          </div>
        </div>
        <div class="skill-actions">
          <button
            class="btn btn-primary"
            :disabled="!learnCheck(skill).ok"
            @click="learnSkill(skill.id)"
          >
            {{ learnCheck(skill).ok ? '参悟' : learnCheck(skill).reason }}
          </button>
        </div>
      </div>
    </div>
    <div v-else class="empty-text">暂无可参悟之绝学，且去历练、寻访秘籍。</div>
  </div>
</template>
