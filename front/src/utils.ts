import { ACCESS_TOKEN, REFRESH_TOKEN, SETTINGS } from "./constants"
import * as punycode from "punycode"

function isObject(val) {
	return val !== null && typeof val === "object" && !Array.isArray(val)
}

// token
export const getAccessToken = () => {
	return localStorage.getItem(ACCESS_TOKEN)
}

export const getRefreshToken = () => {
	return localStorage.getItem(REFRESH_TOKEN)
}

export const setAccessToken = (value: string) => {
	localStorage.setItem(ACCESS_TOKEN, value)
	return true
}

export const setRefreshToken = (value: string) => {
	localStorage.setItem(REFRESH_TOKEN, value)
	return true
}

export const isSuccessCode = (code: number) => {
	return code >= 200 && code < 300
}

// global setting
export const getSetting = () => {
	return JSON.parse(localStorage.getItem(SETTINGS) || "{}")
}

export const setSetting = (value: string) => {
	localStorage.setItem(
		SETTINGS,
		isObject(value) ? JSON.stringify(value) : value,
	)
}
