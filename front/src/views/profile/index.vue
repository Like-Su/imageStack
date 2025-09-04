<script lang="ts" setup>
import { computed, ref, reactive } from "vue"
import { UploadOutlined } from "@ant-design/icons-vue"
import { useUserStore } from "@/stores/user.ts"
import { type UserInfo } from "@/api/user.ts"
import { useSettingStore } from "@/stores/settings.ts"
import { useHead } from "@vueuse/head"
import { message } from "ant-design-vue"

const useUser = useUserStore()
const useSettings = useSettingStore()
const files = ref<any[]>([]) // Antd file-list 类型

const user = computed(() => useUser.user)

const userStatus = computed(() => (user.value.status === 0 ? "正常" : "禁用"))
const userRoles = computed(() => user.value.roles?.join("、"))
const userPicture = computed(() => user.value.picture)

console.log(user)
const userPermissions = computed(() => {
	return user.value.permissions
		.map((permission) => permission.description)
		.join(",")
})
const accountCreate = computed(() =>
	new Date(user.value.createTime).toLocaleString(),
)

// 自定义上传逻辑
const beforeUpload = (file: File) => {
	files.value = [file] // 覆盖，只保留一个头像
	return false // 阻止 a-upload 自动上传
}

const saveUserProfile = async () => {
	if (files.value.length !== 0) {
		// 更新头像：把文件传给后端
		await useUser.updateProfile(files.value[0])
	}
	await useUser.updateUser(user.value)
}

useHead({
	title: "个人中心 | ImageStack",
})
</script>

<template>
	<div class="profile-page" :class="useSettings.globalBgClass">
		<a-form :model="user" :label-col="{ span: 4 }" :wrapper-col="{ span: 14 }">
			<!-- 头像 -->
			<a-form-item label="头像">
				<a-upload
					name="file"
					:show-upload-list="false"
					:before-upload="beforeUpload"
				>
					<template v-if="userPicture">
						<img :src="userPicture" alt="picture" class="avatar" />
					</template>
					<template v-else>
						<a-button> <UploadOutlined /> 上传头像 </a-button>
					</template>
				</a-upload>
			</a-form-item>

			<!-- 昵称 -->
			<a-form-item label="昵称">
				<a-input v-model:value="user.nickname" placeholder="请输入昵称" />
			</a-form-item>

			<!-- 邮箱 -->
			<a-form-item label="邮箱">
				<span>{{ user.email }}</span>
			</a-form-item>

			<!-- 用户状态 -->
			<a-form-item label="用户状态">
				<span>{{ userStatus }}</span>
			</a-form-item>

			<!-- 角色 -->
			<a-form-item label="角色">
				<span>{{ userRoles }}</span>
			</a-form-item>

			<!-- 权限 -->
			<a-form-item label="权限">
				<span>{{ userPermissions }}</span>
			</a-form-item>

			<!-- 注册时间 -->
			<a-form-item label="注册时间">
				<span>{{ accountCreate }}</span>
			</a-form-item>

			<!-- 按钮 -->
			<a-form-item :wrapper-col="{ span: 30 }">
				<a-button
					type="primary"
					class="w-full !h-[46px] !text-[16px]"
					@click="saveUserProfile"
				>
					保存修改
				</a-button>
			</a-form-item>
		</a-form>
	</div>
</template>

<style lang="scss" scoped>
.profile-page {
	padding: 24px;
	border-radius: 8px;
	max-width: 800px;
	margin: 0 auto;
	box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}
.avatar {
	width: 80px;
	height: 80px;
	border-radius: 50%;
	object-fit: cover;
	border: 2px solid #eee;
	cursor: pointer;
}
</style>
