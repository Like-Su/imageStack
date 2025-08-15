import { ACCESS_TOKEN, REFRESH_TOKEN, SETTINGS, USER_INFO } from "./constants"
import * as punycode from "punycode"
import type { UserInfo } from "@/api/user.ts"

export interface Settings {
	theme: string
	isCollapse: boolean
}

function isObject(val: any) {
	return val !== null && typeof val === "object" && !Array.isArray(val)
}

// token
export const getAccessToken = () => {
	return localStorage.getItem(ACCESS_TOKEN)
}

export const getRefreshToken = () => {
	return localStorage.getItem(REFRESH_TOKEN)
}

export const clearToken = () => {
	localStorage.removeItem(ACCESS_TOKEN)
	localStorage.removeItem(REFRESH_TOKEN)
	return true
}

export const setAccessToken = (value: string) => {
	localStorage.setItem(ACCESS_TOKEN, value)
	return true
}

export const setRefreshToken = (value: string) => {
	localStorage.setItem(REFRESH_TOKEN, value)
	return true
}

export const getUser = () => {
	const user = localStorage.getItem(USER_INFO)
	return user ? JSON.parse(user) : null
}

export const setUserInfo = (userInfo: UserInfo) => {
	localStorage.setItem(USER_INFO, JSON.stringify(userInfo))
}

export const isSuccessCode = (code: number) => {
	return code >= 200 && code < 300
}

const getTheme = () => {
	return window.matchMedia("(prefers-color-scheme: dark)").media
		? "dark"
		: "light"
}

// global setting
export const getSetting = (): Settings => {
	const settings =
		localStorage.getItem(SETTINGS) ??
		`{"theme": "${getTheme()}","isCollapse": false}`
	return JSON.parse(settings)
}

export const setSetting = (value: Settings | string) => {
	localStorage.setItem(
		SETTINGS,
		isObject(value) ? JSON.stringify(value) : (value as string),
	)
}
