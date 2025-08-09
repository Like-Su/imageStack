<script lang="ts" setup>
import { computed, ref } from "vue"
import { UploadOutlined } from "@ant-design/icons-vue"
import { useUserStore } from "@/stores/user.ts"
import type { UserInfo } from "@/api/user.ts"
import { useSettingStore } from "@/stores/settings.ts"

const useUser = useUserStore()
const useSettings = useSettingStore()

const user = reactive<UserInfo>(useUser.user)
const userStatus = computed(() => (user.status === 0 ? "正常" : "禁用"))
const userRoles = computed(() => user.roles?.join("、"))
const userPermissions = computed(() => {
	return user?.permissions.map((permission) => permission.description).join(",")
})
const accountCreate = computed(() => new Date(user.createTime).toLocaleString())

const saveUserProfile = () => {
	console.log("save success")
}
</script>
<template>
	<div class="profile-page" :class="useSettings.globalBgClass">
		<a-form :model="user" :label-col="{ span: 4 }" :wrapper-col="{ span: 14 }">
			<!--			头像-->
			<a-form-item label="头像">
				<a-upload name="file" :show-upload-list="false">
					<img
						v-if="user.picture"
						:src="user.picture"
						alt="picture"
						class="avatar"
					/>
					<a-button v-else> <UploadOutlined /> 上传头像 </a-button>
				</a-upload>
			</a-form-item>
			<!--	昵称 -->
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
			<!-- 账户注册时间 -->
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
