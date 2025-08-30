<script setup lang="ts">
import { ref, h, computed } from "vue"
import { useRouter } from "vue-router"
import type { MenuProps, ItemType } from "ant-design-vue"
import { sidebarRoutes, fixedRoutes } from "@/router" // ← 请确保这两个是独立导出
import type { RouteRecordRaw } from "vue-router"
import { MenuUnfoldOutlined, MenuFoldOutlined } from "@ant-design/icons-vue"
import { useSettingStore } from "@/stores/settings.ts"

const useSettings = useSettingStore()
const props = defineProps({
	theme: String,
	toggleCollapsed: Function,
	collapsed: Boolean,
})

const routerInstance = useRouter()
const selectedKeys = ref<string[]>([])
const openKeys = ref<string[]>([])

function getItem(
	label: string,
	key: string,
	icon?: () => any,
	children?: ItemType[],
): ItemType {
	return {
		key,
		icon: icon ? h(icon()) : undefined,
		children,
		label,
	}
}

// 递归构建菜单
function buildMenuFromRoutes(routes: RouteRecordRaw[]): ItemType[] {
	const result: ItemType[] = []
	for (const route of routes) {
		// 忽略没有 meta 或 title 的
		if (!route.meta?.title && !route.children) continue

		// 单页
		if (!route.children || route.children.length === 0) {
			result.push(getItem(route.meta?.title!, route.path, route.meta?.icon))
		} else {
			// 多子项
			const children: ItemType[] = route.children
				.filter((child) => child.meta?.title)
				.map((child) =>
					getItem(
						child.meta!.title,
						`${route.path}/${child.path}`.replace(/\/+/g, "/"), // 合并路径
						child.meta?.icon,
					),
				)
			// 顶部分组
			const parentTitle =
				route.meta?.title ??
				(route.children ? route.children[0].meta?.title : "")
			const parentIcon =
				route.meta?.icon ?? (route.children ? route.children[0].meta?.icon : "")
			result.push(getItem(parentTitle, route.path, parentIcon, children))
		}
	}
	return result
}

const items: ItemType[] = buildMenuFromRoutes([
	...fixedRoutes,
	...sidebarRoutes,
])

const handleClick: MenuProps["onClick"] = ({ key }) => {
	selectedKeys.value = [key]
	routerInstance.push(key)
}

const themeClass = computed(() =>
	props.theme === "dark" ? "!text-white" : "!text-black",
)
</script>

<template>
	<div
		class="sidebar-wrapper h-full flex flex-col drak:bg-[#001529] text-white"
	>
		<!-- 顶部 Logo + 折叠按钮 -->
		<div
			class="sidebar-header h-16 flex items-center justify-between px-4 text-xl font-bold border-b border-white/10"
		>
			<!-- Logo 区域 -->
			<span v-show="!collapsed" :class="themeClass"> ImageStack </span>
		</div>

		<!-- 菜单 -->
		<a-menu
			v-model:openKeys="openKeys"
			v-model:selectedKeys="selectedKeys"
			class="flex-1"
			:theme="theme"
			mode="inline"
			:items="items"
			:collapsed="collapsed"
			@click="handleClick"
		/>
	</div>
</template>
