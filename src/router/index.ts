import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'menu',
      component: () => import('../views/MainMenu.vue'),
    },
    {
      path: '/game',
      name: 'game',
      component: () => import('../views/GameView.vue'),
    },
    {
      path: '/battle',
      name: 'battle',
      component: () => import('../views/BattleView.vue'),
    },
  ],
})

export default router
