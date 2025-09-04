<script setup lang="ts">
import logo from "@/assets/logo.jpeg"
import {
	LockOutlined,
	MailOutlined,
	SafetyOutlined,
} from "@ant-design/icons-vue"
import { useUserStore } from "@/stores/user.ts"
import { inject, ref, reactive } from "vue"
import { CAPTCHA_TYPE, MESSAGE_EMITTER } from "@/constants.ts"
import { useRouter } from "vue-router"
import { useSettingStore } from "@/stores/settings.ts"
import { useHead } from "@vueuse/head"
import { type Forget, sendCaptcha } from "@/api/user.ts" // 新增接口

const useSettings = useSettingStore()
const messageEmitter = inject(MESSAGE_EMITTER)
const router = useRouter()
const userStore = useUserStore()

// 表单数据
const formState = reactive<Forget>({
	email: "",
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

	const res = await sendCaptcha(formState.email, CAPTCHA_TYPE.FORGET)
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

// 提交表单
const onFinish = async () => {
	if (formState.password !== formState.confirmPassword) {
		messageEmitter?.emit("error", "两次输入的密码不一致")
		return
	}
	const res = await userStore.forgetPassword(formState)
	if (!res.success) {
		messageEmitter?.emit("error", res.message)
		return
	}
	messageEmitter?.emit("success", "密码重置成功，请登录")
	router.push({ name: "Login" })
}

// 表单校验规则
const rules = {
	email: [{ required: true, message: "请输入邮箱" }],
	password: [{ required: true, message: "请输入新密码" }],
	confirmPassword: [{ required: true, message: "请确认新密码" }],
	captcha: [{ required: true, message: "请输入验证码" }],
}

useHead({
	title: "忘记密码 | ImageStack",
})
</script>

<template>
	<div
		class="w-screen h-screen flex items-center justify-center"
		:class="useSettings.globalBgClass"
	>
		<a-card :bordered="true" hoverable class="w-[500px] h-[600px]">
			<div class="w-full flex flex-col items-center mt-[40px]">
				<img :src="logo" alt="logo" class="w-[96px] h-[96px] rounded-full" />
				<h1 class="text-2xl font-bold">忘记密码</h1>
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

					<!-- 验证码 -->
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

					<!-- 新密码 -->
					<a-form-item name="password" :rules="rules.password" class="h-[48px]">
						<a-input-password
							v-model:value="formState.password"
							placeholder="请输入新密码"
							class="h-[48px]"
						>
							<template #prefix><LockOutlined /></template>
						</a-input-password>
					</a-form-item>

					<!-- 确认新密码 -->
					<a-form-item
						name="confirmPassword"
						:rules="rules.confirmPassword"
						class="h-[48px]"
					>
						<a-input-password
							v-model:value="formState.confirmPassword"
							placeholder="请确认新密码"
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
							重置密码
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
