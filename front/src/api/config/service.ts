import axios, { type AxiosResponse, type AxiosRequestConfig } from "axios"
import {
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
	// responseType: 'json'
	// validateStatus: isErrorCode,
}

const axiosInstance = axios.create(config)

axiosInstance.interceptors.request.use((config) => {
	const accessToken = getAccessToken()
	if (config.url.includes("/api/picture/download")) {
		window.open(`${config.url}?id=${config.params.id}`, "_blank")
		return config
	}
	if (accessToken) {
		config.headers.Authorization = `Bearer ${accessToken}`
	}
	return config
}, Promise.reject)

axiosInstance.interceptors.response.use(
	(response: AxiosResponse) => {
		// if (response.data instanceof Blob) {
		// 	const image = new Blob([response.data])
		// 	const url = URL.createObjectURL(image)
		// 	const a = document.createElement("a")
		// 	a.href = url
		// 	a.download = "image.jpg"
		// 	a.click()
		// }
		return response.data
	},
	async (err) => {
		const { data, config } = err.response

		if (refreshsing) {
			return new Promise((resolve) => taskQueue.push({ config, resolve }))
		}

		if (data.statusCode === 401 && !config.url.includes("/user/refresh")) {
			refreshsing = true
			const res = await newRefreshToken()
			refreshsing = false
			if (res.status === 200) {
				takeQueue.forEach(({ config, resolve }) => {
					resolve(axios(config))
				})
			} else {
				return Promise.reject(res.data)
			}
		}

		return err.response
	},
)

export default axiosInstance
