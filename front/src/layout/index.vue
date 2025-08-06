<template>
	<div class="app-wrapper min-h-screen" :class="useSettings.themeClass">
		<div
			:class="[
				'sidebar-containertransition-all duration-500',
				useSettings.isCollapse ? 'w-16' : 'w-64',
				useSettings.sidebarBgClass,
			]"
		>
			<!--			<div v-if="!useSettings.isCollapse"></div>-->
			<!--			<div v-else class="text-center">≡</div>-->
			<!--			<button-->
			<!--				@click="useSettings.toggleSidebar"-->
			<!--				class="mt-4 w-full border px-2 py-1 rounded text-xs"-->
			<!--			>-->
			<!--				{{ useSettings.isCollapse ? "展开" : "收起" }}-->
			<!--			</button>-->
			<Sidebar
				:theme="useSettings.theme"
				:toggleCollapsed="useSettings.toggleSidebar"
				:collapsed="useSettings.isCollapse"
			></Sidebar>
		</div>

		<div class="main-container">
			<div
				class="header p-4 flex justify-between"
				:class="useSettings.headerBgClass"
			>
				<span>Header</span>
				<button
					@click="useSettings.toggleTheme"
					class="border px-3 py-1 rounded"
				>
					切换主题（当前：{{ useSettings.theme }})
				</button>
			</div>
			<div class="app-main p-6">
				<router-view />
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { useSettingStore } from "@/stores/settings.ts"
import Sidebar from "@/layout/components/Sidebar/Sidebar.vue"

const useSettings = useSettingStore()
</script>

<style scoped>
@import "@/style/global.scss";

.app-wrapper {
	display: flex;
	transition:
		background-color 0.3s ease,
		color 0.3s ease;

	background-color: var(--bg-color);
	color: var(--text-color);

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
}
</style>
