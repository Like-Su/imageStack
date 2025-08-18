import { defineStore } from "pinia"
import type { User, UserInfo } from "@/api/user.ts"
import {
	getUserInfo,
	login,
	updateUserInfo,
	uploadConfirm,
	uploadProfile,
	uploadProfileHeader,
} from "@/api/user.ts"
import {
	isSuccessCode,
	setAccessToken,
	setRefreshToken,
	getUser,
	setUserInfo,
} from "@/utils.ts"
import { computed, ref } from "vue"

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
		await updateUserInfo(user)
		Object.assign(user, userInfo)
		setUserInfo(userInfo)
	}

	const updateProfile = async (profile: File) => {
		const data = (await uploadProfile(profile.name)).data
		if (!data) return false
		const { headerInfo, url } = data
		const res = await uploadProfileHeader(url as string, profile)

		const confirmResult = await uploadConfirm(headerInfo)
		if (!confirmResult.data) return false

		const userInfo = (await getUserInfo()).data
		if (!data) return false

		// Object.assign(user, userInfo)
		user.value = userInfo
		setUserInfo(user)
		return true
	}

	return {
		user,
		loginUser,
		updateUser,
		updateProfile,
	}
})
