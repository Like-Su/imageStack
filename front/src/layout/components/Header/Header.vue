<script setup lang="ts">
import { useSettingStore } from "@/stores/settings.ts"
import {
	SearchOutlined,
	FilterOutlined,
	BellOutlined,
} from "@ant-design/icons-vue"
import { computed } from "vue"
import sun from "@/assets/svg/sun.svg"
import moon from "@/assets/svg/moon.svg"
import { useUserStore } from "@/stores/user.ts"

const useUser = useUserStore()
const useSettings = useSettingStore()

const themeIcon = computed(() => (useSettings.theme === "light" ? sun : moon))

// 切换主题方法
const toggleTheme = () => {
	useSettings.toggleTheme()
}
</script>

<template>
	<header class="w-full h-14 flex items-center justify-between px-4 text-white">
		<!-- 搜索框 -->
		<div class="flex items-center flex-1 max-w-xl">
			<div class="flex items-center bg-[#1f1f1f] rounded-full px-4 py-2 flex-1">
				<SearchOutlined class="text-gray-400 text-lg" />
				<input
					type="text"
					placeholder="Search your photos"
					class="flex-1 bg-transparent outline-none text-gray-200 px-3"
				/>
				<FilterOutlined class="text-gray-400 text-lg cursor-pointer" />
			</div>
		</div>

		<!-- 右侧按钮 -->
		<div class="flex items-center gap-4 ml-4">
			<!-- 主题切换 -->
			<button
				@click="toggleTheme"
				class="p-2 hover:bg-gray-200 rounded-full flex items-center justify-center cursor-pointer transition-all"
			>
				<img :src="themeIcon" width="24" height="24" alt="" />
			</button>

			<!-- 通知 -->
			<button class="p-2 hover:bg-gray-800 rounded-full cursor-pointer">
				<BellOutlined class="text-lg" />
			</button>

			<!-- 用户头像 -->
			<a-Dropdown trigger="click">
				<div
					class="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer"
				>
					<img
						:src="useUser.user.picture"
						v-if="useUser.user.picture"
						class="w-full h-full rounded-full"
					/>
					<div
						v-else
						class="w-full h-full bg-green-800 rounded flex justify-center items-center text-2xl"
					>
						{{ useUser.user.nickname.slice(0, 1) }}
					</div>
				</div>
			</a-Dropdown>
		</div>
	</header>
</template>

<style scoped></style>
