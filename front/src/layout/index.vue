<template>
	<div class="app-wrapper min-h-screen" :class="themeClass">
		<div
			:class="[
				'sidebar-container p-4 transition-all duration-300',
				isSidebarCollapsed ? 'w-16' : 'w-64',
				sidebarBgClass,
			]"
		>
			<div v-if="!isSidebarCollapsed">Sidebar 内容</div>
			<div v-else class="text-center">≡</div>
			<button
				@click="toggleSidebar"
				class="mt-4 w-full border px-2 py-1 rounded text-xs"
			>
				{{ isSidebarCollapsed ? "展开" : "收起" }}
			</button>
		</div>

		<div class="main-container">
			<div class="header p-4 flex justify-between" :class="headerBgClass">
				<span>Header</span>
				<button @click="toggleTheme" class="border px-3 py-1 rounded">
					切换主题（当前：{{ currentTheme }})
				</button>
			</div>
			<div class="app-main p-6">
				<router-view />
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from "vue"

const themes = ["light", "dark", "blue", "green"]
const currentTheme = ref("light")

const themeClass = computed(() => `theme-${currentTheme.value}`)

const sidebarBgClass = computed(() => {
	switch (currentTheme.value) {
		case "dark":
			return "bg-gray-900 text-white"
		case "blue":
			return "bg-blue-700 text-white"
		case "green":
			return "bg-green-400 text-black"
		default:
			return "bg-gray-100 text-black"
	}
})

const headerBgClass = computed(() => {
	switch (currentTheme.value) {
		case "dark":
			return "bg-gray-800 text-white"
		case "blue":
			return "bg-blue-600 text-white"
		case "green":
			return "bg-green-300 text-black"
		default:
			return "bg-gray-200 text-black"
	}
})

const toggleTheme = () => {
	const idx = themes.indexOf(currentTheme.value)
	currentTheme.value = themes[(idx + 1) % themes.length]
	updateThemeClass()
	localStorage.setItem("theme", currentTheme.value)
}

const isSidebarCollapsed = ref(false)
const toggleSidebar = () => {
	isSidebarCollapsed.value = !isSidebarCollapsed.value
	localStorage.setItem("sidebar-collapsed", isSidebarCollapsed.value.toString())
}

const updateThemeClass = () => {
	themes.forEach((t) => document.documentElement.classList.remove(`theme-${t}`))
	document.documentElement.classList.add(`theme-${currentTheme.value}`)
}

onMounted(() => {
	const savedTheme = localStorage.getItem("theme")
	if (savedTheme && themes.includes(savedTheme)) {
		currentTheme.value = savedTheme
	} else {
		currentTheme.value = window.matchMedia("(prefers-color-scheme: dark)")
			.matches
			? "dark"
			: "light"
	}
	updateThemeClass()

	isSidebarCollapsed.value =
		localStorage.getItem("sidebar-collapsed") === "true"
})
</script>

<style scoped>
.app-wrapper {
	display: flex;
	transition:
		background-color 0.3s ease,
		color 0.3s ease;
}
.main-container {
	flex: 1;
	display: flex;
	flex-direction: column;
}
.app-main {
	flex: 1;
}
.sidebar-container {
	overflow: hidden;
	min-height: 100vh;
}

/* 主题色变量也可以放在这里，根据需要 */
.theme-light {
	--bg-color: white;
	--text-color: black;
}

.theme-dark {
	--bg-color: #000;
	--text-color: #fff;
}

.theme-blue {
	--bg-color: #3b82f6;
	--text-color: #fff;
}

.theme-green {
	--bg-color: #22c55e;
	--text-color: #000;
}

.app-wrapper {
	background-color: var(--bg-color);
	color: var(--text-color);
}
</style>
