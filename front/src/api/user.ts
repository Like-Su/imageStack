import type { ApiResponse } from "@/api/response.ts"
import request from "./config/service.ts"
import type { CAPTCHA_TYPE } from "@/constants.ts"

interface Permission {
	id: number
	code: number
	description: number
}

export interface User {
	email: string
	password: string
	captcha: string
}

export interface UserInfo {
	id: number
	email: string
	nickanme: string
	picture: string
	status: number
	permissions: Permission[]
	roles: string[]
	createTime: number
	updateTime: number
}

export interface Register extends User {
	username: string
}

export interface Forget extends User {
	confirmPassword: string
}

interface TokenResponse {
	access_token: string
	refresh_token: string
}

export interface UserResponse extends TokenResponse {
	userInfo: UserInfo
}

export const captcha = async (email: string, type: CAPTCHA_TYPE) => {
	return await request.get("/api/user/catcha", {
		params: {
			email,
			type,
		},
	})
}

export const login = async (user: User): Promise<ApiResponse<UserResponse>> => {
	return await request.post("/api/user/login", user)
}

export const register = async (
	user: Register,
): Promise<ApiResponse<UserResponse>> => {
	return await request.post("/api/user/register", {
		email: user.email,
		username: user.username,
		password: user.password,
		captcha: user.captcha,
	})
}

export const forget = async (
	user: Forget,
): Promise<ApiResponse<TokenResponse>> => {
	return await request.post("/api/user/forget", {
		email: user.email,
		password: user.password,
		captcha: user.captcha,
	})
}

export const updateUserInfo = async (
	user: User,
): Promise<ApiResponse<UserResponse>> => {
	return await request.post("/api/user/update_user_info", {
		email: user.email,
		password: user.password,
		captcha: user.captcha,
	})
}

export const uploadProfile = async (
	fileName: string,
): Promise<ApiResponse<UserResponse>> => {
	return await request.get("/api/user/upload", {
		params: {
			file_name: fileName,
		},
	})
}

export const sendCaptcha = async (email: string, type: CAPTCHA_TYPE) => {
	return await request.get("/api/user/captcha", {
		params: {
			email: encodeURIComponent(email),
			type,
		},
	})
}

export const uploadProfileHeader = async (url: string, file: File) => {
	return await request.put(url, file)
}

export const uploadConfirm = async (headerInfo) => {
	return await request.post("/api/user/upload/confirm", headerInfo)
}

export const getUserInfo = async () => {
	return await request.post("/api/user/user_info")
}

export const refreshToken = async (
	refreshToken: string,
): Promise<ApiResponse<TokenResponse>> => {
	return await request.get("/api/user/refresh", {
		params: {
			refresh_token: refreshToken,
		},
	})
}
