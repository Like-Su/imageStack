<script setup lang="ts">
import { ref, computed } from "vue"
import { SearchOutlined, FilterOutlined } from "@ant-design/icons-vue"
import sun from "@/assets/svg/sun.svg"
import moon from "@/assets/svg/moon.svg"
import { useSettingStore } from "@/stores/settings.ts"
import { useUserStore } from "@/stores/user.ts"
import { useRouter } from "vue-router"
import { message } from "ant-design-vue"
import { search } from "@/api/pictures.ts"

const useUser = useUserStore()
const useSettings = useSettingStore()
const router = useRouter()

const themeIcon = computed(() => (useSettings.theme === "light" ? sun : moon))

const keyword = ref("")
const searchType = ref<"all" | "tag" | "name">("all")
const searchResult = ref<any[]>([])

const toggleTheme = () => {
	useSettings.toggleTheme()
}

const handleSearch = async () => {
	if (!keyword.value.trim()) {
		message.warning("请输入搜索关键词")
		return
	}
	try {
		const { data } = await search(keyword.value, searchType.value)
		searchResult.value = data || []
		message.success(
			`搜索完成，共 ${Array.isArray(data) ? data.length : 0} 条结果`,
		)
	} catch (e) {
		message.error("搜索失败")
		console.error(e)
	}
}

const onMenuClick = ({ key }: { key: string }) => {
	const start: Record<string, () => void> = {
		logout: () => {
			useUser.logout()
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
					v-model="keyword"
					type="text"
					placeholder="Search your photos"
					class="flex-1 bg-transparent outline-none text-gray-200 px-3"
					@keyup.enter="handleSearch"
				/>

				<!-- 关键修复：用 prop 绑定 selectedKeys（不要把数组字面量放到 v-model） -->
				<a-dropdown>
					<template #overlay>
						<a-menu :selectedKeys="[searchType]">
							<a-menu-item key="all" @click="searchType = 'all'"
								>全部</a-menu-item
							>
							<a-menu-item key="tag" @click="searchType = 'tag'"
								>标签</a-menu-item
							>
							<a-menu-item key="name" @click="searchType = 'name'"
								>图片名</a-menu-item
							>
						</a-menu>
					</template>

					<!-- 下拉触发器（点击图标展开） -->
					<FilterOutlined class="text-gray-400 text-lg cursor-pointer" />
				</a-dropdown>
			</div>
		</div>

		<!-- 右侧按钮 -->
		<div class="flex items-center gap-4 ml-4">
			<button
				@click="toggleTheme"
				class="p-2 hover:bg-gray-200 rounded-full flex items-center justify-center cursor-pointer transition-all"
			>
				<img :src="themeIcon" width="24" height="24" alt="" />
			</button>

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
