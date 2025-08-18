<template>
	<div class="app-wrapper min-h-screen" :class="useSettings.themeClass">
		<div
			:class="[
				'sidebar-containertransition-all duration-500',
				useSettings.isCollapse ? 'w-16' : 'w-64',
				useSettings.globalBgClass,
			]"
		>
			<Sidebar
				:theme="useSettings.theme"
				:toggleCollapsed="useSettings.toggleSidebar"
				:collapsed="useSettings.isCollapse"
			></Sidebar>
		</div>

		<div class="main-container">
			<div
				class="header h-16 px-4 border-b border-white/10 flex justify-between"
				:class="useSettings.globalBgClass"
			>
				<Header></Header>
			</div>
			<div class="app-main p-6" :class="useSettings.globalBgClass">
				<router-view />
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { useSettingStore } from "@/stores/settings.ts"
import Sidebar from "./components/Sidebar/Sidebar.vue"
import Header from "./components/Header/Header.vue"

const useSettings = useSettingStore()
</script>

<style scoped>
@import "@/style/global.scss";

.fade-enter-active,
.fade-leave-active {
	transition: all 0.6s ease;
}
.fade-enter-from,
.fade-leave-to {
	opacity: 0;
}

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
