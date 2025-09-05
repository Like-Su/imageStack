<script setup lang="ts">
import logo from "@/assets/logo.jpeg"
import { type User } from "@/api/user"
import { UserOutlined, LockOutlined } from "@ant-design/icons-vue"
import { useUserStore } from "@/stores/user.ts"
import { inject } from "vue"
import { MESSAGE_EMITTER } from "@/constants.ts"
import { useRouter } from "vue-router"
import { useSettingStore } from "@/stores/settings.ts"
import { useHead } from "@vueuse/head"

const useSettings = useSettingStore()
const messageEmitter = inject(MESSAGE_EMITTER)

const router = useRouter()
const userStore = useUserStore()
const formState = reactive<User>({
	email: "",
	password: "",
})

const onFinish = async () => {
	const res = await userStore.loginUser(formState)
	console.log(res)
	if (!res.success) {
		messageEmitter.emit("error", res.message)
		return
	}
	messageEmitter.emit("success", "登录成功")
	router.push({ name: "DashboardIndex" })
}

const onFinishFailed = () => {}

const rules = {
	email: [
		{ required: true, message: "请输入用户名" },
		{ min: 3, message: "用户名不能少于3个字符" },
		{ max: 20, message: "用户名不能超过20个字符" },
	],
	password: [{ required: true, message: "请输入密码" }],
}

useHead({
	title: "登录 | ImageStack",
})
</script>

<template>
	<div
		class="w-screen h-screen flex items-center justify-center"
		:class="useSettings.globalBgClass"
	>
		<a-card :bordered="true" hoverable="true" class="w-[500px] h-[600px]">
			<div class="w-full flex flex-col items-center mt-[40px]">
				<img :src="logo" alt="logo" class="w-[96px] h-[96px] rounded-full" />
				<h1 class="text-2xl font-bold">ImageStack</h1>
			</div>
			<div class="mt-[30px] p-[26px]">
				<a-form
					:model="formState"
					name="normal_login"
					class="login-form"
					@finish="onFinish"
					@finishFailed="onFinishFailed"
				>
					<a-form-item name="email" :rules="rules.email" class="h-[48px]">
						<a-input
							v-model:value="formState.email"
							placeholder="请输入邮箱"
							class="h-[48px]"
						>
							<template #prefix>
								<UserOutlined class="site-form-item-icon" />
							</template>
						</a-input>
					</a-form-item>

					<a-form-item name="password" :rules="rules.password" class="h-[48px]">
						<a-input-password
							v-model:value="formState.password"
							placeholder="请输入密码"
							class="h-[48px]"
						>
							<template #prefix>
								<LockOutlined class="site-form-item-icon" />
							</template>
						</a-input-password>
					</a-form-item>

					<a-form-item
						class="w-[100%] h-[42px] flex justify-center items-center"
					>
						<a-button
							type="primary"
							html-type="submit"
							block
							style="width: 420px; height: 38px"
						>
							登录
						</a-button>
					</a-form-item>

					<a-form-item class="flex justify-center items-center">
						<router-link to="/register">现在注册</router-link>
						/
						<router-link to="/forget">忘记密码</router-link>
					</a-form-item>
				</a-form>
			</div>
		</a-card>
	</div>
</template>

<style scoped lang="scss"></style>
