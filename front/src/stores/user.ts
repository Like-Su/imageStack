import { defineStore } from "pinia"
import type { User, UserInfo } from "@/api/user.ts"
import { login } from "@/api/user.ts"
import { isSuccessCode, setAccessToken, setRefreshToken } from "@/utils.ts"

export const useUserStore = defineStore("user", () => {
	const user = reactive<UserInfo>({
		id: 0,
		email: "",
		nickanme: "",
		picture: "",
		status: 0,
		permissions: [],
		roles: [],
		createTime: 0,
		updateTime: 0,
	})

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
		Object.assign(user, res.userInfo)

		setAccessToken(res.access_token)
		setRefreshToken(res.refresh_token)
		return {
			success: true,
		}
	}

	return {
		user,
		loginUser,
	}
})
