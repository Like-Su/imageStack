import type { ApiResponse } from "@/api/response.ts"
import request from "./config/service.ts"
import type { CAPTCHA_TYPE } from '@/constants.ts';

interface Permission {
	id: number
	code: number
	description: number
}

export interface User {
	email: string
	password: string
	// captcha: string;
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
interface TokenResponse {
	access_token: string
	refresh_token: string
}

export interface UserResponse extends TokenResponse {
	userInfo: UserInfo
}

export const captcha = async (email:string, type: CAPTCHA_TYPE) => {
  return await request.get("/api/user/catcha", {
    params: {
      email,
      type
    }
  })
}

export const login = async (user: User): Promise<ApiResponse<UserResponse>> => {
	return await request.post("/api/user/login", user)
}

export const register = async (user: User): Promise<ApiResponse<UserResponse>> => {
  return await request.post("/api/user/register", user)
}

export const updateUserInfo = async (user: User): Promise<ApiResponse<UserResponse>> => {
  return await request.post("/api/user/update_user_info", user)
}

export const uploadProfile = async (fileName: string): Promise<ApiResponse<UserResponse>> => {
  return await request.get("/api/user/upload", {
    params: {
      file_name: fileName
    }
  })
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
