import axios, { type AxiosResponse, type AxiosRequestConfig } from "axios"
import {
	clearToken,
	getAccessToken,
	getRefreshToken,
	setAccessToken,
	setRefreshToken,
} from "@/utils.ts"
import { refreshToken } from "@/api/user.ts"

interface PendingTask {
	config: AxiosRequestConfig
	resolve: Function
}

let refreshsing = false
const taskQueue: PendingTask[] = []

const isErrorCode = (status: number) =>
	(status >= 200 && status < 300) || status === 301

export const newRefreshToken = async () => {
	const oldRefreshToken = getRefreshToken(),
		response = await refreshToken(oldRefreshToken),
		tokens = response.data
	if (tokens.access_token && tokens.refresh_token) {
		setAccessToken(tokens.access_token)
		setRefreshToken(tokens.refresh_token)
	}
	return response
}

const config: AxiosRequestConfig = {
	baseURL: import.meta.env.BASE_URL,
	timeout: 30000,
	method: "get",
}

const axiosInstance = axios.create(config)
const isHttp = (url: string) => /^(http|https).*/.test(url)

axiosInstance.interceptors.request.use((config) => {
	const accessToken = getAccessToken()
	if (config.url.includes("/api/picture/download")) {
		window.open(`${config.url}?id=${config.params.id}`, "_blank")
		return config
	}
	if (!isHttp(config.url!) && accessToken) {
		config.headers.Authorization = `Bearer ${accessToken}`
	}

	return config
}, Promise.reject)

axiosInstance.interceptors.response.use(
	(response: AxiosResponse) => {
		return response.data
	},
	async (err) => {
		if (axios.isAxiosError(err)) {
			const { data, config } = err.response || {}

			if (data?.statusCode === 401 && config?.url?.includes("/user/refresh")) {
				clearToken()
			}

			if (refreshsing) {
				return new Promise((resolve) => taskQueue.push({ config, resolve }))
			}

			if (data?.statusCode === 401 && !config?.url?.includes("/user/refresh")) {
				refreshsing = true
				const res = await newRefreshToken()
				refreshsing = false
				if (res.status === 200) {
					taskQueue.forEach(({ config, resolve }) => resolve(axios(config)))
					return axios(config) // 关键：重新发起当前请求
				} else {
					return Promise.reject(res.data)
				}
			}

			// 只返回纯净数据
			return Promise.reject(data || err.message)
		}

		return Promise.reject(err)
	},
)

export default axiosInstance
