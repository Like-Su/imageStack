<script setup lang="ts">
import { useSettingStore } from "@/stores/settings.ts"
import {
	SearchOutlined,
	FilterOutlined,
	// BellOutlined,
} from "@ant-design/icons-vue"
import { computed } from "vue"
import sun from "@/assets/svg/sun.svg"
import moon from "@/assets/svg/moon.svg"
import { useUserStore } from "@/stores/user.ts"
import { useRouter } from "vue-router"
import { message } from "ant-design-vue"

const useUser = useUserStore()
const useSettings = useSettingStore()
const router = useRouter()

const themeIcon = computed(() => (useSettings.theme === "light" ? sun : moon))

// 切换主题方法
const toggleTheme = () => {
	useSettings.toggleTheme()
}

// 菜单点击
const onMenuClick = ({ key }: { key: string }) => {
	const start = {
		logout: () => {
			useUser.logout() // store 里实现清空 token / user
			message.success("已退出登录")
			router.push("/login")
		},
		profile: () => {
			router.push("/profile/index")
		},
	}
	return start[key] ? start[key]() : null
}
</script>

<template>
	<header class="w-full h-14 flex items-center justify-between px-4 text-white">
		<!-- 搜索框 -->
		<div class="flex items-center flex-1 max-w-xl">
			<div
				class="flex items-center rounded-full px-4 py-2 flex-1"
				:class="useSettings.globalBgClass"
			>
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

			<!-- 用户头像 + 下拉菜单 -->
			<a-dropdown trigger="click">
				<div
					class="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer"
				>
					<template v-if="useUser.user && useUser.user.picture">
						<img
							:src="useUser.user.picture"
							class="w-full h-full rounded-full"
						/>
					</template>
					<template v-else>
						<div
							class="w-full h-full bg-green-800 rounded flex justify-center items-center text-2xl text-white"
						>
							{{ useUser.user?.nickname?.slice(0, 1) || "" }}
						</div>
					</template>
				</div>

				<template #overlay>
					<a-menu @click="onMenuClick">
						<a-menu-item key="profile">个人中心</a-menu-item>
						<a-menu-divider />
						<a-menu-item key="logout">退出登录</a-menu-item>
					</a-menu>
				</template>
			</a-dropdown>
		</div>
	</header>
</template>
