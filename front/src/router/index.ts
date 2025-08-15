import type { RouteRecordRaw } from "vue-router"
import { createRouter, createWebHistory } from "vue-router"
import Layout from "@/layout/index.vue"
import { getAccessToken } from "@/utils.ts"
import {
	MailOutlined,
	SettingOutlined,
	UserOutlined,
} from "@ant-design/icons-vue"

declare module "vue-router" {
	interface RouteRecordRaw {
		meta: {
			icon: Function
			title: string
		}
	}
}

export const fixedRoutes: RouteRecordRaw[] = [
	{
		path: "/",
		name: "Login",
		component: () => import("@/views/login/index.vue"),
	},
	{
		path: "/dashboard",
		name: "Dashboard",
		component: Layout,
		children: [
			{
				path: "index",
				name: "DashboardIndex",
				component: () => import("@/views/dashboard/index.vue"),
				meta: {
					icon: () => MailOutlined,
					title: "dashboard",
				},
			},
		],
	},
]

export const sidebarRoutes: RouteRecordRaw[] = [
	{
		path: "/photos",
		component: Layout,
		redirect: "photos/list",
		children: [
			{
				path: "list",
				name: "Photos",
				component: () => import("@/views/photos/index.vue"),
				meta: {
					icon: () => SettingOutlined,
					title: "photos",
				},
			},
		],
	},
	{
		path: "/tags",
		component: Layout,
		redirect: "tags/list",
		children: [
			{
				path: "list",
				name: "Tags",
				component: () => import("@/views/tags/index.vue"),
				meta: {
					icon: () => SettingOutlined,
					title: "tags",
				},
			},
		],
	},
	{
		path: "/trash",
		component: Layout,
		redirect: "trash/list",
		children: [
			{
				path: "list",
				name: "Trash",
				component: () => import("@/views/trash/index.vue"),
				meta: {
					icon: () => SettingOutlined,
					title: "trash",
				},
			},
		],
	},
	{
		path: "/profile",
		component: Layout,
		redirect: "profile/index",
		children: [
			{
				path: "index",
				name: "Profile",
				component: () => import("@/views/profile/index.vue"),
				meta: {
					icon: () => UserOutlined,
					title: "profile",
				},
			},
		],
	},
]

export const routes = [...fixedRoutes, ...sidebarRoutes]

const router = createRouter({
	routes,
	history: createWebHistory(),
})

// 路由守卫
router.beforeEach((to, from, next) => {
	const token = getAccessToken()
	if (to.name !== "Login") {
		if (!token) {
			return next({ name: "Login" })
		}
		return next()
	}

	if (token && to.name === "Login") {
		return next({ name: "DashboardIndex" })
	}
	return next()
})

export default router
