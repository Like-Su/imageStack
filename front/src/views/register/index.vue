<script setup lang="ts">
import logo from "@/assets/logo.jpeg"
import {
	LockOutlined,
	MailOutlined,
	SafetyOutlined,
	UserOutlined,
} from "@ant-design/icons-vue"
import { useUserStore } from "@/stores/user.ts"
import { inject, ref } from "vue"
import { CAPTCHA_TYPE, MESSAGE_EMITTER } from "@/constants.ts"
import { useRouter } from "vue-router"
import { useSettingStore } from "@/stores/settings.ts"
import { useHead } from "@vueuse/head"
import type { Register } from "@/api/user.ts"
import { sendCaptcha } from "@/api/user.ts" // 需要在 api 里新增

const useSettings = useSettingStore()
const messageEmitter = inject(MESSAGE_EMITTER)
const router = useRouter()
const userStore = useUserStore()

const formState = reactive<Register>({
	email: "",
	username: "",
	password: "",
	confirmPassword: "",
	captcha: "",
})

// 倒计时
const countDown = ref(0)
let timer: NodeJS.Timeout | null = null

// 发送验证码
const onSendCaptcha = async () => {
	if (!formState.email) {
		messageEmitter?.emit("error", "请先输入邮箱")
		return
	}
	if (countDown.value > 0) return

	const res = await sendCaptcha(formState.email, CAPTCHA_TYPE.REGISTER)
	if (!res || res.code !== 200) {
		messageEmitter?.emit("error", res?.message || "发送失败")
		return
	}

	messageEmitter?.emit("success", "验证码已发送，请检查邮箱")
	countDown.value = 60
	timer = setInterval(() => {
		countDown.value--
		if (countDown.value <= 0 && timer) {
			clearInterval(timer)
		}
	}, 1000)
}

const onFinish = async () => {
	if (formState.password !== formState.confirmPassword) {
		messageEmitter?.emit("error", "两次输入的密码不一致")
		return
	}
	const res = await userStore.registerUser(formState)
	if (!res.success) {
		messageEmitter?.emit("error", res.message)
		return
	}
	messageEmitter?.emit("success", "注册成功，请登录")
	router.push({ name: "Login" })
}

const rules = {
	email: [{ required: true, message: "请输入邮箱" }],
	username: [
		{ required: true, message: "请输入用户名" },
		{ min: 3, message: "用户名不能少于3个字符" },
		{ max: 10, message: "用户名不能超过10个字符" },
	],
	password: [{ required: true, message: "请输入密码" }],
	confirmPassword: [{ required: true, message: "请确认密码" }],
	captcha: [{ required: true, message: "请输入验证码" }],
}

useHead({
	title: "注册 | ImageStack",
})
</script>

<template>
	<div
		class="w-screen h-screen flex items-center justify-center"
		:class="useSettings.globalBgClass"
	>
		<a-card :bordered="true" hoverable class="w-[500px] h-[700px]">
			<div class="w-full flex flex-col items-center mt-[40px]">
				<img :src="logo" alt="logo" class="w-[96px] h-[96px] rounded-full" />
				<h1 class="text-2xl font-bold">注册账号</h1>
			</div>
			<div class="mt-[30px] p-[26px]">
				<a-form :model="formState" @finish="onFinish">
					<!-- 邮箱 -->
					<a-form-item name="email" :rules="rules.email" class="h-[48px]">
						<a-input
							v-model:value="formState.email"
							placeholder="请输入邮箱"
							class="h-[48px]"
						>
							<template #prefix><MailOutlined /></template>
						</a-input>
					</a-form-item>

					<!-- 验证码输入框 + 获取按钮 -->
					<a-form-item name="captcha" :rules="rules.captcha" class="h-[48px]">
						<div class="flex gap-2">
							<a-input
								v-model:value="formState.captcha"
								placeholder="请输入验证码"
								class="h-[48px] flex-1"
							>
								<template #prefix><SafetyOutlined /></template>
							</a-input>
							<a-button
								type="primary"
								:disabled="countDown > 0"
								@click="onSendCaptcha"
								style="width: 140px; height: 48px"
							>
								{{ countDown > 0 ? countDown + "s后重试" : "获取验证码" }}
							</a-button>
						</div>
					</a-form-item>

					<!-- 用户名 -->
					<a-form-item name="username" :rules="rules.username" class="h-[48px]">
						<a-input
							v-model:value="formState.username"
							placeholder="请输入用户名"
							class="h-[48px]"
						>
							<template #prefix><UserOutlined /></template>
						</a-input>
					</a-form-item>

					<!-- 密码 -->
					<a-form-item name="password" :rules="rules.password" class="h-[48px]">
						<a-input-password
							v-model:value="formState.password"
							placeholder="请输入密码"
							class="h-[48px]"
						>
							<template #prefix><LockOutlined /></template>
						</a-input-password>
					</a-form-item>

					<!-- 确认密码 -->
					<a-form-item
						name="confirmPassword"
						:rules="rules.confirmPassword"
						class="h-[48px]"
					>
						<a-input-password
							v-model:value="formState.confirmPassword"
							placeholder="请确认密码"
							class="h-[48px]"
						>
							<template #prefix><LockOutlined /></template>
						</a-input-password>
					</a-form-item>

					<a-form-item class="w-[100%] flex justify-center">
						<a-button
							type="primary"
							html-type="submit"
							block
							style="width: 420px; height: 38px"
						>
							注册
						</a-button>
					</a-form-item>

					<a-form-item class="flex justify-center items-center">
						<a @click="router.push({ name: 'Login' })">返回登录</a>
					</a-form-item>
				</a-form>
			</div>
		</a-card>
	</div>
</template>
