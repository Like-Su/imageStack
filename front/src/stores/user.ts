import { defineStore } from "pinia"
import type { Forget, Register, User, UserInfo } from "@/api/user.ts"
import {
	getUserInfo,
	login,
	register,
	updateUserInfo,
	uploadConfirm,
	uploadProfile,
	uploadProfileHeader,
	sendCaptcha,
	forget,
} from "@/api/user.ts"
import {
	isSuccessCode,
	setAccessToken,
	setRefreshToken,
	getUser,
	setUserInfo,
	clearToken,
} from "@/utils.ts"
import { ref } from "vue"

export const useUserStore = defineStore("user", () => {
	const defaultUser: UserInfo = {
		id: 0,
		email: "",
		nickanme: "",
		picture: "",
		status: 0,
		permissions: [],
		roles: [],
		createTime: 0,
		updateTime: 0,
	}

	const user = ref<UserInfo>({ ...defaultUser, ...getUser() })

	const loginUser = async (user: User) => {
		const userResponse = await login(user)
		// 登录成功
		if (!isSuccessCode(userResponse.code)) {
			// 错误提示
			return {
				success: false,
				message: userResponse.message,
			}
		}

		const res = userResponse.data
		// 写入用户信息
		// Object.assign(user, res.userInfo)
		user.value = res.userInfo

		setUserInfo(res.userInfo)
		setAccessToken(res.access_token)
		setRefreshToken(res.refresh_token)
		return {
			success: true,
		}
	}

	const updateUser = async (userInfo: UserInfo) => {
		const newUserInfo = (await updateUserInfo(user)).data
		user.value = newUserInfo
		setUserInfo(newUserInfo)
	}

	const updateProfile = async (profile: File) => {
		const data = (await uploadProfile(profile.name)).data
		if (!data) return false
		const { headerInfo, url } = data
		const res = await uploadProfileHeader(url as string, profile)
		console.log(res)
		const confirmResult = await uploadConfirm(headerInfo)
		if (!confirmResult.data) return false

		const userInfo = (await getUserInfo()).data
		if (!data) return false

		// Object.assign(user, userInfo)
		user.value = userInfo
		setUserInfo(user.value)
		return true
	}

	const registerUser = async (user: Register & { confirmPassword: string }) => {
		// 效验验证码
		if (user.captcha.length < 4) {
			return {
				success: false,
				message: "验证码错误",
			}
		}
		// 对比密码
		if (user.password !== user.confirmPassword) {
			return {
				success: false,
				message: "两次密码不一致",
			}
		}
		const res = await register({
			email: user.email,
			username: user.username,
			password: user.password,
			captcha: user.captcha,
		})
		if (!isSuccessCode(res.code)) {
			return {
				success: false,
				message: res.message,
			}
		}
		return {
			success: true,
		}
	}

	const forgetPassword = async (user: Forget) => {
		if (user.captcha.length < 4) {
			return {
				success: false,
				message: "验证码错误",
			}
		}
		if (user.password !== user.confirmPassword) {
			return {
				success: false,
				message: "两次密码不一致",
			}
		}
		const res = await forget({
			email: user.email,
			password: user.password,
			captcha: user.captcha,
		})
		if (!isSuccessCode(res.code)) {
			return {
				success: false,
				message: res.message,
			}
		}
		return {
			success: true,
		}
	}

	const sendCaptcha = async (email: string) => {
		const res = await sendCaptcha(email)
		if (!isSuccessCode(res.code)) {
			return {
				success: false,
				message: res.message,
			}
		}
		return {
			success: true,
		}
	}

	const logout = () => {
		user.value = { ...defaultUser, ...getUser() }
		clearToken()
	}

	return {
		user,
		loginUser,
		updateUser,
		updateProfile,
		registerUser,
		forgetPassword,
		logout,
	}
})
