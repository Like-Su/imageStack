import type { RouteRecordRaw } from "vue-router"
import { createRouter, createWebHistory } from "vue-router"
import Layout from "@/layout/index.vue"

const routes: RouteRecordRaw[] = [
	{
		path: "/",
		name: "Login",
		component: () => import("@/views/login/index.vue"),
	},
	{
		path: "/dashboard",
		name: "Dashboard",
		component: Layout,
		// component: () => import("@/views/dashboard/index.vue"),
	},
]

const router = createRouter({
	routes,
	history: createWebHistory(),
})

// 路由守卫
// router.beforeEach((to, from, next) => {
//   const token = getToken()
//   if (to.path !== "/login") {
//     if (!token) {
//       return next({ name: "Login" })
//     }
//     return next()
//   }
//   if (token) {
//     return next({ name: "Dashboard" })
//   }
//   return next()
// })

export default router
