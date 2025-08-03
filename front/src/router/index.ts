import type { RouteRecordRaw } from "vue-router"
import { createRouter, createWebHistory } from "vue-router"

const routes: RouteRecordRaw[] = [
  {
    path: "/home",
    component: () => import("../App.vue"),
  },
]

export default createRouter({
  routes,
  history: createWebHistory(),
})
